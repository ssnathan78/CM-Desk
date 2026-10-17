import { and, eq, like, or } from "drizzle-orm"

import { sendApiError } from "../../../lib/apiErrors"
import { db } from "../../../lib/drizzle"
import { syncGetKiteInstance } from "../../../lib/kiteUtils"
import logger from "../../../lib/logger"
import { ATTRIBUTE_FILL_CONFIRM, confirmationError, confirmed } from "../../../lib/operatorConfirm"
import { fills, orders, positions } from "../../../lib/schema"
import withSession from "../../../lib/session"
import { recordAttributedFill } from "../../../lib/trading/ledger"
import { RISK_STRATEGY_KEYS, type RiskStrategyKey } from "../../../lib/trading/riskEngine"
import {
  acceptedQuantity,
  allocateBrokerTrades,
  reconcileTargetTied,
  type StrategyGap,
  strategyQuantityDifference,
  type TradeSlice,
} from "../../../lib/trading/strategyReconcile"
import { isSyntheticProvenance } from "../../../lib/trading/types"
import { isMockOrder } from "../../../lib/utils"

type BrokerPosition = {
  exchange?: string
  tradingsymbol?: string
  product?: string
  quantity?: number
}

type BrokerTrade = {
  trade_id?: string
  exchange?: string
  tradingsymbol?: string
  product?: string
  transaction_type?: string
  quantity?: number
  average_price?: number
  price?: number
  fill_timestamp?: string
  order_timestamp?: string
}

function isStrategy(value: string): value is RiskStrategyKey {
  return (RISK_STRATEGY_KEYS as readonly string[]).includes(value)
}

function bookKey(exchange: string, symbol: string, product: string) {
  return `${exchange}|${symbol}|${product || ""}`
}

async function liveBooks() {
  const rows = await db.select().from(positions)
  return rows.filter(row => !isSyntheticProvenance(row.provenance))
}

async function gapsFor(strategy: string, broker: BrokerPosition[]): Promise<StrategyGap[]> {
  const books = await liveBooks()
  const keys = new Set<string>()
  for (const row of broker) {
    if (!row.tradingsymbol || !row.exchange) continue
    keys.add(bookKey(row.exchange, row.tradingsymbol, row.product || ""))
  }
  for (const row of books) {
    keys.add(bookKey(row.exchange, row.tradingsymbol, row.product || ""))
  }
  const out: StrategyGap[] = []
  for (const key of keys) {
    const [exchange, tradingsymbol, product] = key.split("|")
    const brokerQty = broker
      .filter(
        row => bookKey(row.exchange || "", row.tradingsymbol || "", row.product || "") === key
      )
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0)
    let strategyQty = 0
    let otherQty = 0
    for (const row of books) {
      if (bookKey(row.exchange, row.tradingsymbol, row.product || "") !== key) continue
      if (row.strategy === strategy) strategyQty += row.quantity
      else otherQty += row.quantity
    }
    const difference = strategyQuantityDifference({ brokerQty, strategyQty, otherQty })
    if (difference === 0 && brokerQty === 0 && strategyQty === 0) continue
    if (difference === 0) continue
    out.push({ exchange, tradingsymbol, product, brokerQty, strategyQty, otherQty, difference })
  }
  return out.sort((a, b) => a.tradingsymbol.localeCompare(b.tradingsymbol))
}

async function usedTradeQty(tradeId: string): Promise<number> {
  const rows = await db
    .select({ quantity: fills.quantity })
    .from(fills)
    .where(
      or(
        eq(fills.fingerprint, `kite-trade:${tradeId}`),
        like(fills.fingerprint, `kite-trade:${tradeId}:%`)
      )
    )
  return rows.reduce((sum, row) => sum + row.quantity, 0)
}

async function priorStrategyTouches(strategy: string, tradingsymbol: string): Promise<number> {
  const [orderRows, fillRows] = await Promise.all([
    db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.strategy, strategy), eq(orders.tradingsymbol, tradingsymbol)))
      .limit(1),
    db
      .select({ id: fills.id })
      .from(fills)
      .where(and(eq(fills.strategy, strategy), eq(fills.tradingsymbol, tradingsymbol)))
      .limit(1),
  ])
  return orderRows.length + fillRows.length
}

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  try {
    const strategy = String(req.query.strategy || req.body?.strategy || "")
    if (!isStrategy(strategy)) return res.status(400).json({ error: "Pick a strategy." })
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" })
    }
    if (req.method === "POST" && !confirmed(req.body?.confirm, ATTRIBUTE_FILL_CONFIRM)) {
      return res.status(409).json({ error: confirmationError(ATTRIBUTE_FILL_CONFIRM) })
    }
    if (isMockOrder() || !user.session?.access_token) {
      return res.status(409).json({ error: "A live Kite session is required." })
    }
    const kite = syncGetKiteInstance(user) as unknown as {
      getPositions: () => Promise<{ net?: BrokerPosition[] }>
      getTrades: () => Promise<BrokerTrade[]>
    }
    const positionBook = await kite.getPositions()
    const broker = positionBook.net ?? []

    if (req.method === "GET") {
      return res.json({ strategy, rows: await gapsFor(strategy, broker) })
    }

    const exchange = String(req.body?.exchange || "")
    const tradingsymbol = String(req.body?.tradingsymbol || "").toUpperCase()
    const product = String(req.body?.product || "")
    const rows = await gapsFor(strategy, broker)
    const gap = rows.find(
      row =>
        row.exchange === exchange && row.tradingsymbol === tradingsymbol && row.product === product
    )
    if (!gap) return res.status(404).json({ error: "That symbol has no difference." })
    const tied = reconcileTargetTied({
      strategyQty: Number(gap.strategyQty),
      priorTouches: await priorStrategyTouches(strategy, tradingsymbol),
    })
    if (!tied) {
      return res.status(409).json({
        error: "This strategy has no position or order in that symbol.",
      })
    }
    const quantity = acceptedQuantity(gap.difference, Number(req.body?.quantity))
    if (quantity == null) {
      return res.status(400).json({ error: "Quantity must stay within the difference." })
    }
    const side = quantity > 0 ? "BUY" : "SELL"
    const trades = (await kite.getTrades()) || []
    const matching: TradeSlice[] = []
    for (const trade of trades) {
      if (String(trade.tradingsymbol || "").toUpperCase() !== tradingsymbol) continue
      if ((trade.product || "") !== product) continue
      if (String(trade.transaction_type || "").toUpperCase() !== side) continue
      const tradeId = String(trade.trade_id || "")
      if (!tradeId) continue
      const price = Number(trade.average_price ?? trade.price)
      const when = new Date(trade.fill_timestamp || trade.order_timestamp || Date.now())
      matching.push({
        tradeId,
        quantity: Number(trade.quantity || 0),
        price,
        occurredAt: Number.isNaN(when.getTime()) ? new Date() : when,
        alreadyUsed: await usedTradeQty(tradeId),
      })
    }
    const allocated = allocateBrokerTrades({ accepted: quantity, trades: matching })
    const manual = req.body?.manual as
      | { date?: string; quantity?: number; price?: number }
      | undefined
    if (allocated.shortfall > 0 && !manual) {
      return res.json({
        needManual: true,
        shortfall: allocated.shortfall,
        side,
        covered: Math.abs(quantity) - allocated.shortfall,
      })
    }
    if (allocated.shortfall > 0) {
      const manualQty = Number(manual?.quantity)
      const manualPrice = Number(manual?.price)
      const manualDate = String(manual?.date || "")
      if (!/^\d{4}-\d{2}-\d{2}$/.test(manualDate)) {
        return res.status(400).json({ error: "Date is required." })
      }
      if (!Number.isInteger(manualQty) || manualQty < 1 || manualQty > allocated.shortfall) {
        return res
          .status(400)
          .json({ error: "Manual quantity cannot exceed the uncovered shares." })
      }
      if (!(manualPrice > 0)) return res.status(400).json({ error: "Price is required." })
    }

    for (const slice of allocated.slices) {
      const booked = await recordAttributedFill({
        strategy,
        exchange,
        tradingsymbol,
        product,
        side,
        quantity: slice.quantity,
        price: slice.price,
        occurredAt: slice.occurredAt,
        fingerprint: slice.consumesTrade
          ? `kite-trade:${slice.tradeId}`
          : `kite-trade:${slice.tradeId}:${slice.quantity}:${slice.occurredAt.toISOString()}`,
        brokerTradeId: slice.consumesTrade ? slice.tradeId : null,
      })
      if (!booked) return res.status(409).json({ error: `Could not book ${tradingsymbol}.` })
    }
    if (allocated.shortfall > 0 && manual) {
      const occurredAt = new Date(`${manual.date}T10:00:00+05:30`)
      const booked = await recordAttributedFill({
        strategy,
        exchange,
        tradingsymbol,
        product,
        side,
        quantity: Number(manual.quantity),
        price: Number(manual.price),
        occurredAt,
        fingerprint: `recon-manual:${strategy}:${tradingsymbol}:${manual.date}:${allocated.shortfall}:${manual.price}:${occurredAt.getTime()}`,
      })
      if (!booked) return res.status(409).json({ error: `Could not book ${tradingsymbol}.` })
    }
    return res.json({ ok: true, rows: await gapsFor(strategy, broker) })
  } catch (error) {
    return sendApiError(res, error, logger, "desk/reconcile-strategy")
  }
})
