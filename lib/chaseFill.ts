import { CHASE_STATUS, STATUS_TRIGGER_PENDING } from "./constants"
import {
  type ActiveBookBreakdown,
  activeBookFromSources,
  executionModeSwitchBlocked,
  splitLedgerQty,
} from "./trading/bookSplit"
import { isSyntheticProvenance, ledgerProvenance } from "./trading/types"

export type ChaseFillDecision =
  | "already_filled"
  | "wait_open_order"
  | "place_entry"
  | "signal_only"
  | "other_book_open"
  | "leftover_open"

/** Sign of an already-open Chase book. Null means flat. */
export function chaseSideFromNetQty(netQty: number): "LONG" | "SHORT" | null {
  if (netQty > 0) return "LONG"
  if (netQty < 0) return "SHORT"
  return null
}
export type ChaseEntryFillResult = "filled" | "placed" | "wait" | "failed" | "signal_only"

export type ChaseBookBreakdown = ActiveBookBreakdown

export function chaseLotsFromConfig(lots: number | null | undefined): number {
  const n = Number(lots)
  if (!Number.isFinite(n) || n < 1) return 0
  return Math.trunc(n)
}

export function splitChaseLedgerQty(
  positions: Array<{
    tradingsymbol?: string | null
    quantity?: number | null
    provenance?: string | null
  }>,
  tradingsymbol?: string | null
): { paperLedgerQty: number; liveLedgerQty: number } {
  return splitLedgerQty(positions, { tradingsymbol })
}

/** Active Chase book: paper/mock ledger vs Kite/live ledger. Never mix the two. */
export function chaseBookFromSources(input: {
  paperBook: boolean
  kiteQty: number
  paperLedgerQty: number
  liveLedgerQty: number
}): ChaseBookBreakdown {
  return activeBookFromSources(input)
}

export function chaseBookNetQty(input: {
  paperBook: boolean
  kiteQty: number
  paperLedgerQty?: number
  liveLedgerQty?: number
}): number {
  return chaseBookFromSources({
    paperBook: input.paperBook,
    kiteQty: input.kiteQty,
    paperLedgerQty: input.paperLedgerQty ?? 0,
    liveLedgerQty: input.liveLedgerQty ?? 0,
  }).netQty
}

/** Flatten/exit size is the open book only. Never fall back to configured lots (that opens a new position). */
export function chaseFlattenQty(netQty: number): number {
  const q = Math.abs(Number(netQty) || 0)
  return q > 0 ? q : 0
}

/**
 * Roll the contracts you actually hold. Configured lots are for the next fresh entry,
 * not for resizing an open book on expiry day.
 */
export function chaseRolloverOrderQty(input: {
  netQty: number
  currentLotSize: number
  nextLotSize: number
}): { closeQty: number; openQty: number } {
  const closeQty = chaseFlattenQty(input.netQty)
  const currentLot = Math.trunc(Number(input.currentLotSize) || 0)
  const nextLot = Math.trunc(Number(input.nextLotSize) || 0) || currentLot
  if (closeQty <= 0 || currentLot <= 0 || nextLot <= 0 || closeQty % currentLot !== 0) {
    return { closeQty, openQty: closeQty }
  }
  return { closeQty, openQty: (closeQty / currentLot) * nextLot }
}

/**
 * Minute SL-hit: a working stop that already covered the book must not look like a failed job,
 * and must not MARKET a second flatten. Same rule on paper (filled ledger SL) and live (Kite SL).
 */
export type ChaseSlBreachPlan =
  | "place_flatten"
  | "convert_working_stop"
  | "already_covered"
  | "phantom_empty"

export function planChaseSlBreachFlatten(input: {
  netQty: number
  workingStopsFilledThisTick: number
  hasWorkingProtectiveStop: boolean
  /** Live Kite filled qty on the cover side (SL / trigger orders only). */
  filledCoverQty?: number
}): ChaseSlBreachPlan {
  const open = chaseFlattenQty(input.netQty)
  const filled = Math.max(0, Number(input.filledCoverQty) || 0)
  // Paper matcher: a stop fill this tick already covered. Do not MARKET lots.
  if (input.workingStopsFilledThisTick > 0) return "already_covered"
  if (open === 0) return filled > 0 ? "already_covered" : "phantom_empty"
  // Stale book qty after a full cover (6 Oct Nifty: COMPLETE 130 while qty still −130).
  if (filled >= open) return "already_covered"
  if (input.hasWorkingProtectiveStop) return "convert_working_stop"
  return "place_flatten"
}

/** Filled protective stop size from today's Kite book (COMPLETE / partial fill). */
function isChaseProtectiveStopOrder(o: {
  order_type?: string | null
  trigger_price?: number | null
  tag?: string | null
}): boolean {
  const type = (o.order_type || "").toUpperCase().trim()
  if (type === "SL" || type === "SL-M" || type === "SLM") return true
  if (Number(o.trigger_price) > 0) return true
  return false
}

export function chaseProtectiveStopFillQty(input: {
  tradingsymbol: string
  side: "BUY" | "SELL"
  kiteOrders?: Array<{
    tradingsymbol?: string | null
    transaction_type?: string | null
    status?: string | null
    filled_quantity?: number | null
    quantity?: number | null
    order_type?: string | null
    trigger_price?: number | null
    tag?: string | null
  }>
}): number {
  let filled = 0
  for (const o of input.kiteOrders ?? []) {
    if (o.tradingsymbol !== input.tradingsymbol || o.transaction_type !== input.side) continue
    const status = (o.status || "").toUpperCase().trim()
    if (status === "CANCELLED" || status === "REJECTED") continue
    if (!isChaseProtectiveStopOrder(o)) continue
    const qty = Number(o.filled_quantity || 0)
    if (qty > 0) filled += qty
  }
  return filled
}

export function chaseExecutionModeSwitchBlocked(input: {
  processMock: boolean
  fromMode: "PAPER" | "LIVE"
  toMode: "PAPER" | "LIVE"
  paperLedgerQty: number
  liveLedgerQty: number
  kiteQty: number
}): { ok: true } | { ok: false; error: string } {
  return executionModeSwitchBlocked({ ...input, strategy: "Chase" })
}

export function chaseSideHasPosition(side: "LONG" | "SHORT", netQty: number): boolean {
  return side === "LONG" ? netQty > 0 : netQty < 0
}

export function chaseStatusHasPosition(status: string | null | undefined, netQty: number): boolean {
  if (status === CHASE_STATUS.LONG) return netQty > 0
  if (status === CHASE_STATUS.SHORT) return netQty < 0
  return false
}

export function chaseFillAllowsStatusFlip(fill: ChaseEntryFillResult): boolean {
  // "placed" with an empty book is a phantom LONG/SHORT. Flip only after size exists.
  return fill === "filled"
}

/** Open LONG/SHORT with a flat book must not punch configured lots (that opens a new position). */
export function decideChaseInPositionSync(input: {
  netQty: number
  side: "LONG" | "SHORT"
  hasOpenEntryOrder: boolean
}): "hold" | "wait_entry" | "reset_empty" {
  if (chaseSideHasPosition(input.side, input.netQty)) return "hold"
  if (input.hasOpenEntryOrder) return "wait_entry"
  return "reset_empty"
}

export function chasePendingStatusFor(side: "LONG" | "SHORT"): string {
  return side === "LONG" ? CHASE_STATUS.AWAITING_LONG : CHASE_STATUS.AWAITING_SHORT
}

export function chaseFillFromDecision(
  action: ChaseFillDecision
): ChaseEntryFillResult | "place_entry" {
  if (action === "already_filled") return "filled"
  if (action === "wait_open_order") return "wait"
  if (action === "signal_only") return "signal_only"
  if (action === "other_book_open" || action === "leftover_open") return "failed"
  return "place_entry"
}

/** Live Kite statuses that mean an entry/SL is still working — do not place another. */
export function isChaseWorkingBrokerStatus(status?: string | null): boolean {
  const s = (status || "").toUpperCase().trim()
  return (
    s === STATUS_TRIGGER_PENDING ||
    s === "OPEN" ||
    s === "OPEN PENDING" ||
    s === "VALIDATION PENDING" ||
    s === "PUT ORDER REQ RECEIVED" ||
    s === "MODIFY PENDING"
  )
}

export function chaseHasWorkingProtectiveStop(input: {
  paperBook: boolean
  tradingsymbol: string
  side: "BUY" | "SELL"
  ledgerOrders: Array<{
    tradingsymbol?: string | null
    purpose?: string | null
    side?: string | null
    provenance?: string | null
  }>
  kiteOrders?: Array<{
    tradingsymbol?: string | null
    transaction_type?: string | null
    status?: string | null
  }>
}): boolean {
  const ledgerHit = input.ledgerOrders.some(o => {
    if (o.tradingsymbol !== input.tradingsymbol || o.purpose !== "SL" || o.side !== input.side) {
      return false
    }
    const paperOrder = isSyntheticProvenance(ledgerProvenance(o.provenance))
    return input.paperBook ? paperOrder : !paperOrder
  })
  if (ledgerHit) return true
  if (input.paperBook) return false
  return (input.kiteOrders ?? []).some(
    o =>
      o.tradingsymbol === input.tradingsymbol &&
      o.transaction_type === input.side &&
      isChaseWorkingBrokerStatus(o.status)
  )
}

export function chaseHasWorkingEntryOrder(input: {
  paperBook: boolean
  tradingsymbol: string
  side: "BUY" | "SELL"
  ledgerOrders: Array<{
    tradingsymbol?: string | null
    purpose?: string | null
    side?: string | null
    provenance?: string | null
  }>
  kiteOrders?: Array<{
    tradingsymbol?: string | null
    transaction_type?: string | null
    status?: string | null
  }>
}): boolean {
  const ledgerHit = input.ledgerOrders.some(o => {
    if (o.tradingsymbol !== input.tradingsymbol || o.purpose !== "ENTRY" || o.side !== input.side) {
      return false
    }
    const paperOrder = isSyntheticProvenance(ledgerProvenance(o.provenance))
    return input.paperBook ? paperOrder : !paperOrder
  })
  if (ledgerHit) return true
  if (input.paperBook) return false
  return (input.kiteOrders ?? []).some(
    o =>
      o.tradingsymbol === input.tradingsymbol &&
      o.transaction_type === input.side &&
      isChaseWorkingBrokerStatus(o.status)
  )
}

/**
 * Production minute-tick for LONG/SHORT. Same rule on paper and live:
 * a filled protective SL that leaves qty=0 must not MARKET the configured lots.
 */
export function chaseEmptyInPositionMustNotPunchLots(
  sync: ReturnType<typeof decideChaseInPositionSync>
): boolean {
  return sync === "reset_empty" || sync === "wait_entry"
}
