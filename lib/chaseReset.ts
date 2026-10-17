import { chaseStatusHasPosition } from "./chaseFill"
import { getChaseBook } from "./chaseSettings"
import { resolveChaseBookBreakdown } from "./chaseSignal"
import { CHASE_STATUS } from "./constants"
import { getChaseStatus, updateChaseStatus } from "./drizzleDbUtils"
import { cancelOrder } from "./kiteUtils"
import logger from "./logger"
import { type ChaseResetProbe, planChaseSignalReset } from "./operatorActionCopy"

export type ChaseResetResult =
  | { ok: true; instrument: string; previousStatus: string | null }
  | { ok: false; error: string; instrument: string; previousStatus: string | null }

/**
 * Drop a phantom LONG/SHORT (or a stuck pending entry) back to AWAITING_SIGNAL
 * so the next hourly job can evaluate a fresh signal.
 *
 * Refuses when the Chase book actually has size, unless `force` is set.
 * Does not flatten Kite — use Square off on Today / Chase / Desk → Positions for that.
 */
export async function resetChaseSignalState(input: {
  instrument?: string
  accessToken?: string
  force?: boolean
}): Promise<ChaseResetResult> {
  const instrument = input.instrument || "NIFTY"
  const row = await getChaseStatus(instrument)
  const previousStatus = row?.status ?? null
  const tradingsymbol = row?.tradingsymbol ?? null

  if (!input.force && tradingsymbol && (previousStatus === "LONG" || previousStatus === "SHORT")) {
    const book = await resolveChaseBookBreakdown(tradingsymbol, input.accessToken || "")
    if (chaseStatusHasPosition(previousStatus, book.netQty)) {
      return {
        ok: false,
        instrument,
        previousStatus,
        error:
          "Chase still has an open book. Square off that position first (Today, Chase plan, or Desk → Positions). Reset only clears a stuck signal.",
      }
    }
  }

  if (tradingsymbol && input.accessToken) {
    const side =
      previousStatus === CHASE_STATUS.LONG || previousStatus === CHASE_STATUS.AWAITING_LONG
        ? "BUY"
        : "SELL"
    try {
      await cancelOrder(tradingsymbol, side, input.accessToken)
    } catch (e) {
      logger.warn("[resetChaseSignalState] cancel pending entry skipped", e)
    }
  }

  const { success, error } = await updateChaseStatus({
    instrument,
    status: CHASE_STATUS.AWAITING_SIGNAL,
    tradingsymbol: "",
    entryPoint: 0,
    stoploss: 0,
    instrumentToken: 0,
    isSignalBreachingTolerance: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  if (!success) {
    return {
      ok: false,
      instrument,
      previousStatus,
      error: error instanceof Error ? error.message : "Could not update chase_status",
    }
  }

  const chase = await getChaseBook(instrument)
  logger.info(`[resetChaseSignalState] ${instrument} ${previousStatus} → AWAITING_SIGNAL`, {
    lots: chase.lots,
  })
  return { ok: true, instrument, previousStatus }
}

async function probeChaseReset(instrument: string, accessToken?: string): Promise<ChaseResetProbe> {
  const row = await getChaseStatus(instrument)
  const previousStatus = row?.status ?? null
  const tradingsymbol = row?.tradingsymbol ?? null
  if (
    !(
      tradingsymbol &&
      (previousStatus === CHASE_STATUS.LONG || previousStatus === CHASE_STATUS.SHORT)
    )
  ) {
    return { instrument, state: "clear" }
  }
  try {
    const book = await resolveChaseBookBreakdown(tradingsymbol, accessToken || "")
    if (chaseStatusHasPosition(previousStatus, book.netQty)) {
      return { instrument, state: "open" }
    }
    return { instrument, state: "clear" }
  } catch (e) {
    logger.warn("[probeChaseReset] quantity unknown", e)
    return { instrument, state: "unknown" }
  }
}

export async function resetAllChaseSignalState(input: {
  accessToken?: string
  force?: boolean
}): Promise<
  | { ok: true; results: ChaseResetResult[] }
  | { ok: false; error: string; results: ChaseResetResult[]; unchanged?: boolean }
> {
  const { listChaseBooks } = await import("./chaseSettings")
  const books = await listChaseBooks()
  if (!input.force) {
    const probes: ChaseResetProbe[] = []
    for (const book of books) {
      probes.push(await probeChaseReset(book.instrument, input.accessToken))
    }
    const plan = planChaseSignalReset(probes)
    if (!plan.ok) {
      return { ok: false, error: plan.error, results: [], unchanged: true }
    }
  }
  const results: ChaseResetResult[] = []
  for (const book of books) {
    results.push(
      await resetChaseSignalState({
        instrument: book.instrument,
        accessToken: input.accessToken,
        force: input.force,
      })
    )
  }
  const failed = results.find(row => !row.ok)
  if (failed && !failed.ok) {
    return {
      ok: false,
      error: `${failed.error} Books reset before this failure were already changed.`,
      results,
    }
  }
  return { ok: true, results }
}
