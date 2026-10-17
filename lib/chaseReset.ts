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
 * Refuse a reset while the book is open or the quantity cannot be proved flat.
 * There is no force flag. An open futures book keeps LONG/SHORT and its stop.
 */
export function chaseResetRefusal(input: {
  status: string | null
  netQty: number | null
  qtyKnown: boolean
}): string | null {
  if (input.status !== CHASE_STATUS.LONG && input.status !== CHASE_STATUS.SHORT) return null
  if (!input.qtyKnown || input.netQty == null) {
    return "Could not prove this book is flat, so it was not reset."
  }
  if (chaseStatusHasPosition(input.status, input.netQty)) {
    return "Chase still has an open book. Square off that position first (Today, Chase plan, or Desk → Positions). Reset only clears a stuck signal."
  }
  return null
}

/**
 * Drop a phantom LONG/SHORT (or a stuck pending entry) back to AWAITING_SIGNAL
 * so the next hourly job can evaluate a fresh signal.
 *
 * Refuses when the Chase book has size, and when that size cannot be read.
 * Does not flatten Kite — use Square off on Today / Chase / Desk → Positions for that.
 */
export async function resetChaseSignalState(input: {
  instrument?: string
  accessToken?: string
}): Promise<ChaseResetResult> {
  const instrument = input.instrument || "NIFTY"
  const row = await getChaseStatus(instrument)
  const previousStatus = row?.status ?? null
  const tradingsymbol = row?.tradingsymbol ?? null

  if (tradingsymbol && (previousStatus === "LONG" || previousStatus === "SHORT")) {
    try {
      const book = await resolveChaseBookBreakdown(tradingsymbol, input.accessToken || "")
      const refusal = chaseResetRefusal({
        status: previousStatus,
        netQty: book.kiteQtyKnown ? book.netQty : null,
        qtyKnown: book.kiteQtyKnown,
      })
      if (refusal) {
        return { ok: false, instrument, previousStatus, error: refusal }
      }
    } catch (e) {
      logger.warn("[resetChaseSignalState] quantity unknown", e)
      return {
        ok: false,
        instrument,
        previousStatus,
        error: "Could not prove this book is flat, so it was not reset.",
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
}): Promise<
  | { ok: true; results: ChaseResetResult[] }
  | { ok: false; error: string; results: ChaseResetResult[]; unchanged?: boolean }
> {
  const { listChaseBooks } = await import("./chaseSettings")
  const books = await listChaseBooks()
  const probes: ChaseResetProbe[] = []
  for (const book of books) {
    probes.push(await probeChaseReset(book.instrument, input.accessToken))
  }
  const plan = planChaseSignalReset(probes)
  if (!plan.ok) {
    return { ok: false, error: plan.error, results: [], unchanged: true }
  }
  const results: ChaseResetResult[] = []
  for (const book of books) {
    results.push(
      await resetChaseSignalState({
        instrument: book.instrument,
        accessToken: input.accessToken,
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
