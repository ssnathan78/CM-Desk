import { and, eq, gte, inArray, sql } from "drizzle-orm"
import { now } from "../clock"
import { USER_OVERRIDE } from "../constants"
import { db } from "../drizzle"
import { liveFlattenSessionBlock } from "../flattenNotice"
import logger from "../logger"
import { jobExecutions, orders } from "../schema"
import { isMarketOpen, isMockOrder } from "../utils"
import { recordAuditEvent } from "./ledger"
import { lotSizeForInstrument } from "./notional"
import { countOpenStrategyPositions } from "./portfolio"
import {
  evaluateOrder,
  inferOrderRole,
  isPaperStrategy,
  lotsForRiskCheck,
  type OrderRole,
  type RiskIntent,
  RiskRejectedError,
  type RiskSettings,
} from "./riskEngine"
import { getRiskSettings } from "./riskSettings"
import { isSyntheticProvenance } from "./types"

/** Job tag → strategy. Chase orders use the tag `chase` and have no job row. */
export async function strategyFromOrderTag(tag?: string | null): Promise<string | null> {
  if (!tag) return null
  if (tag.toLowerCase() === "chase") return "CHASE"
  const rows = await db
    .select({ strategy: jobExecutions.strategy })
    .from(jobExecutions)
    .where(eq(jobExecutions.orderTag, tag))
    .limit(1)
  return rows[0]?.strategy ?? null
}

/**
 * A live modify/cancel (convert a stop to market, resize a stop) never goes
 * through placeOrder. Paper books are refused here so they cannot rewrite a
 * Kite order. Market-closed live exits are refused so the stop stays.
 */
export async function assertLiveBrokerMutation(input: {
  tradingsymbol: string
  quantity: number
  transaction_type: string
  order_type?: string
  tag?: string
  strategy?: string | null
  role: "FLATTEN" | "SL" | "EXIT"
  paperBook: boolean
}): Promise<void> {
  if (input.paperBook) {
    throw new RiskRejectedError({
      ok: false,
      code: "PAPER_BOOK",
      message: "A paper book cannot change a live broker order.",
    })
  }
  const sessionBlock = liveFlattenSessionBlock({
    paperBook: false,
    marketOpen: isMarketOpen(),
  })
  if (sessionBlock) {
    throw new RiskRejectedError({
      ok: false,
      code: "MARKET_CLOSED",
      message: sessionBlock,
    })
  }
  await assertOrderAllowed({
    tradingsymbol: input.tradingsymbol,
    quantity: input.quantity,
    transaction_type: input.transaction_type,
    order_type: input.order_type,
    tag: input.tag,
    strategy: input.strategy,
    role: input.role,
    purpose: input.role,
  })
}

export async function assertOrderAllowed(input: {
  tradingsymbol?: string
  exchange?: string
  transaction_type?: string
  order_type?: string
  product?: string
  quantity?: number
  price?: number
  trigger_price?: number
  tag?: string
  purpose?: string
  role?: OrderRole
  strategy?: string | null
  lots?: number | null
  ltp?: number | null
  ltpAt?: Date | null
}): Promise<void> {
  if (!input.tradingsymbol || !input.quantity || !input.transaction_type) {
    throw new RiskRejectedError({
      ok: false,
      code: "INVALID_INTENT",
      message: "Incomplete order intent",
    })
  }

  const role = input.role ?? inferOrderRole({ purpose: input.purpose, orderType: input.order_type })
  const intent: RiskIntent = {
    role,
    tradingsymbol: input.tradingsymbol,
    quantity: Number(input.quantity),
    side: input.transaction_type === "SELL" ? "SELL" : "BUY",
    product: input.product,
    orderType: input.order_type,
    tag: input.tag,
    price: input.price,
    triggerPrice: input.trigger_price,
    ltp: input.ltp,
    ltpAt: input.ltpAt,
    strategy: input.strategy,
    lots: input.lots,
  }

  let settings: RiskSettings
  try {
    settings = await getRiskSettings()
  } catch (e) {
    logger.error("[riskGate] settings unavailable", e)
    const { recordOperatorAlert } = await import("./alerts")
    await recordOperatorAlert({
      source: "RISK",
      code: "RISK_UNAVAILABLE",
      severity: "ERROR",
      summary: "Risk engine unavailable — fail closed",
      strategy: intent.strategy,
      instrument: intent.tradingsymbol,
      idempotencyKey: `alert:risk-unavailable:${intent.tag || intent.tradingsymbol}:${now().toISOString().slice(0, 16)}`,
    })
    throw new RiskRejectedError({
      ok: false,
      code: "RISK_UNAVAILABLE",
      message: "Risk engine unavailable — fail closed",
    })
  }

  const nowAt = now()
  const minuteAgo = new Date(nowAt.getTime() - 60_000)

  const [openOrdsRaw, recentRaw, dupRaw, jobRows] = await Promise.all([
    db
      .select({ id: orders.id, provenance: orders.provenance })
      .from(orders)
      .where(
        inArray(orders.status, [
          "PENDING",
          "SUBMITTED",
          "ACCEPTED",
          "PARTIALLY_FILLED",
          "UNKNOWN",
          "CANCEL_REQUESTED",
        ])
      ),
    db
      .select({ n: sql<number>`count(*)::int`, provenance: orders.provenance })
      .from(orders)
      .where(gte(orders.createdAt, minuteAgo))
      .groupBy(orders.provenance),
    input.tag
      ? db
          .select({ id: orders.id, provenance: orders.provenance })
          .from(orders)
          .where(
            and(
              eq(orders.orderTag, input.tag),
              eq(orders.tradingsymbol, input.tradingsymbol),
              eq(orders.side, intent.side),
              eq(orders.requestedQty, intent.quantity),
              inArray(orders.status, [
                "PENDING",
                "SUBMITTED",
                "ACCEPTED",
                "PARTIALLY_FILLED",
                "UNKNOWN",
              ])
            )
          )
          .limit(5)
      : Promise.resolve([] as { id: string; provenance: string }[]),
    input.tag
      ? db
          .select({
            userOverride: jobExecutions.userOverride,
            lots: jobExecutions.lots,
            strategy: jobExecutions.strategy,
            instrument: jobExecutions.instrument,
          })
          .from(jobExecutions)
          .where(eq(jobExecutions.orderTag, input.tag))
          .limit(1)
      : Promise.resolve([]),
  ])

  const job = jobRows[0]
  intent.lots = lotsForRiskCheck(intent.lots, job?.lots != null ? Number(job.lots) : null)
  if (job?.instrument) {
    const lotSize = lotSizeForInstrument(String(job.instrument))
    if (lotSize > 0) intent.lotSize = lotSize
  }
  if (!intent.strategy && job?.strategy) intent.strategy = job.strategy
  if (!intent.strategy && input.tag === "chase") intent.strategy = "CHASE"

  const paper = isPaperStrategy(settings, intent.strategy)
  const sameBook = (provenance: string | null | undefined) =>
    paper ? isSyntheticProvenance(provenance) : !isSyntheticProvenance(provenance)
  const openOrds = openOrdsRaw.filter(row => sameBook(row.provenance))
  const recentOrderCount = recentRaw
    .filter(row => sameBook(row.provenance))
    .reduce((n, row) => n + Number(row.n ?? 0), 0)
  const dup = dupRaw.filter(row => sameBook(row.provenance))

  const bookCount = intent.strategy
    ? await countOpenStrategyPositions(intent.strategy, paper ? "PAPER" : "LIVE").catch(() => 0)
    : 0

  const decision = evaluateOrder(intent, {
    settings,
    now: nowAt,
    isMock: isMockOrder(),
    isPaper: paper,
    marketOpen: isMarketOpen(),
    jobAborted: job?.userOverride === USER_OVERRIDE.ABORT,
    openPositionCount: bookCount,
    openOrderCount: openOrds.length,
    recentOrderCount,
    pendingDuplicate: dup.length > 0 && role === "ENTRY",
  })

  if (!decision.ok) {
    await recordAuditEvent({
      eventType:
        decision.code === "DESK_HALTED" || decision.code === "STRATEGY_HALTED"
          ? "RISK_LIMIT_TRIGGERED"
          : "RISK_CHECK_FAILED",
      severity: "ERROR",
      summary: decision.message,
      detail: {
        code: decision.code,
        source: "RISK",
        symbol: intent.tradingsymbol,
        instrument: intent.tradingsymbol,
        role,
        strategy: intent.strategy,
      },
      idempotencyKey: `risk:${decision.code}:${intent.tag || ""}:${intent.tradingsymbol}:${intent.quantity}:${nowAt.toISOString().slice(0, 16)}`,
    })
    throw new RiskRejectedError(decision)
  }
}
