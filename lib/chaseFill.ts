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
    strategy?: string | null
  }>,
  tradingsymbol?: string | null
): { paperLedgerQty: number; liveLedgerQty: number } {
  // Another strategy on the same symbol must not change Chase size. An untagged row still counts.
  return splitLedgerQty(
    positions.filter(pos => !pos.strategy || pos.strategy === "CHASE"),
    { tradingsymbol }
  )
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
  /** Cover fills that belong to this open episode (stops and market/limit covers). */
  filledCoverQty?: number
  /** Signed size this episode opened at, when the open round-trip is known. */
  openedQty?: number | null
  /** Ledger qty after this tick's order sync. Same sign as `netQty` when both are open. */
  ledgerQty?: number | null
  /**
   * Shares still to send. When omitted, derived from kite net, ledger, opened size,
   * and episode fills — never `open − every historical fill`.
   */
  coverQty?: number | null
}): ChaseSlBreachPlan {
  const open = chaseFlattenQty(input.netQty)
  const filled = Math.max(0, Number(input.filledCoverQty) || 0)
  const coverQty =
    input.coverQty != null
      ? Math.max(0, Number(input.coverQty) || 0)
      : chaseCoverOrderQty({
          kiteQty: input.netQty,
          ledgerQty: input.ledgerQty ?? null,
          openedQty: input.openedQty ?? null,
          episodeFilledCoverQty: filled,
        })
  // Paper matcher: a stop fill this tick already covered. Do not MARKET lots.
  if (input.workingStopsFilledThisTick > 0) return "already_covered"
  if (open === 0) return filled > 0 ? "already_covered" : "phantom_empty"
  // Nothing left to send: the episode's covers already account for the displayed net
  // (including a stale position feed that still shows the pre-fill size).
  if (coverQty <= 0) return "already_covered"
  if (input.hasWorkingProtectiveStop) return "convert_working_stop"
  return "place_flatten"
}

/**
 * Live cover size.
 *
 * Kite net is the quantity we would trade. Episode fills are covers since this
 * book opened — not every buy/sell on the symbol today.
 *
 * Subtract a fill only when the kite net has not already dropped by that much
 * from the size the episode opened at. If the open size is unknown, trust the
 * kite net, and use a tighter ledger only as evidence that Kite has not absorbed
 * a fill yet. A fill that covers the whole displayed net sends nothing, so a
 * second market order cannot reverse the book while the position feed lags.
 */
export function chaseCoverOrderQty(input: {
  kiteQty: number
  ledgerQty?: number | null
  openedQty?: number | null
  episodeFilledCoverQty: number
}): number {
  const kite = Number(input.kiteQty) || 0
  const kiteAbs = Math.abs(kite)
  if (kiteAbs === 0) return 0
  const filled = Math.max(0, Number(input.episodeFilledCoverQty) || 0)
  if (filled >= kiteAbs) return 0

  const opened = input.openedQty == null ? null : Number(input.openedQty)
  const openedKnown =
    opened != null &&
    Number.isFinite(opened) &&
    opened !== 0 &&
    Math.sign(opened) === Math.sign(kite)
  if (openedKnown) {
    const reflected = Math.max(0, Math.abs(opened) - kiteAbs)
    const unreflected = Math.max(0, filled - reflected)
    return Math.max(0, kiteAbs - unreflected)
  }

  const ledger = input.ledgerQty == null ? null : Number(input.ledgerQty)
  if (ledger != null && ledger !== 0 && Math.sign(ledger) === Math.sign(kite)) {
    const gap = Math.max(0, kiteAbs - Math.abs(ledger))
    if (gap > 0) return Math.max(0, kiteAbs - Math.min(filled, gap))
  }
  return kiteAbs
}

/**
 * 09:16 opposite-signal exit. The order is a flatten (halt and trading-disabled
 * still allow it). Status becomes AWAITING_SIGNAL only once quantity is flat.
 */
export function planChaseMorningExit(input: { side: "LONG" | "SHORT"; netQty: number }): {
  status: "LONG" | "SHORT" | "AWAITING_SIGNAL"
  order: { side: "BUY" | "SELL"; purpose: "FLATTEN"; quantity: number } | null
} {
  const quantity = chaseFlattenQty(input.netQty)
  const stillOpen = input.side === "LONG" ? input.netQty > 0 : input.netQty < 0
  if (!stillOpen || quantity <= 0) {
    return { status: "AWAITING_SIGNAL", order: null }
  }
  return {
    status: input.side,
    order: {
      side: input.side === "LONG" ? "SELL" : "BUY",
      purpose: "FLATTEN",
      quantity,
    },
  }
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

function isChaseFlattenFill(o: { order_type?: string | null; purpose?: string | null }): boolean {
  const type = (o.order_type || "").toUpperCase().trim()
  if (type === "MARKET" || type === "LIMIT") return true
  const purpose = (o.purpose || "").toUpperCase()
  return purpose === "FLATTEN" || purpose === "EXIT" || purpose === "SQUARE_OFF"
}

function coverOrderTimeMs(o: {
  exchange_timestamp?: string | null
  order_timestamp?: string | null
}): number | null {
  const raw = (o.exchange_timestamp || o.order_timestamp || "").trim()
  if (!raw) return null
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)
  const normalized = hasZone ? raw : `${raw.replace(" ", "T")}+05:30`
  const ms = new Date(normalized).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Filled covers for the current open book: protective stops and market/limit
 * flattens on the cover side, at or after `openedAt`. Earlier round-trips
 * the same day do not reduce this book's cover.
 */
export function chaseEpisodeCoverFillQty(input: {
  tradingsymbol: string
  side: "BUY" | "SELL"
  openedAt?: Date | string | null
  kiteOrders?: Array<{
    tradingsymbol?: string | null
    transaction_type?: string | null
    status?: string | null
    filled_quantity?: number | null
    order_type?: string | null
    trigger_price?: number | null
    purpose?: string | null
    exchange_timestamp?: string | null
    order_timestamp?: string | null
  }>
}): number {
  const openedMs = input.openedAt == null ? null : new Date(input.openedAt).getTime()
  const haveOpened = openedMs != null && Number.isFinite(openedMs)
  let filled = 0
  for (const o of input.kiteOrders ?? []) {
    if (o.tradingsymbol !== input.tradingsymbol || o.transaction_type !== input.side) continue
    const status = (o.status || "").toUpperCase().trim()
    if (status === "CANCELLED" || status === "REJECTED") continue
    if (!isChaseProtectiveStopOrder(o) && !isChaseFlattenFill(o)) continue
    const qty = Number(o.filled_quantity || 0)
    if (!(qty > 0)) continue
    if (haveOpened) {
      const at = coverOrderTimeMs(o)
      if (at != null && at < openedMs) continue
    }
    filled += qty
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

export function chaseCoverMatchesOpenBook(side: "BUY" | "SELL", signedQty: number): boolean {
  if (side === "BUY") return signedQty < 0
  return signedQty > 0
}

/** Clear LONG/SHORT only once the watched quantity is flat. A sent cover is not a flat book. */
export function chaseSlBreachMayClearStatus(input: { plan: string; signedQty: number }): boolean {
  if (
    input.plan !== "phantom_empty" &&
    input.plan !== "already_covered" &&
    input.plan !== "place_flatten" &&
    input.plan !== "convert_working_stop"
  ) {
    return false
  }
  return chaseFlattenQty(input.signedQty) === 0
}

export function chaseHasWorkingSameSideOrder(input: {
  tradingsymbol: string
  side: "BUY" | "SELL"
  kiteOrders?: Array<{
    tradingsymbol?: string | null
    transaction_type?: string | null
    status?: string | null
  }>
}): boolean {
  return (input.kiteOrders ?? []).some(
    o =>
      o.tradingsymbol === input.tradingsymbol &&
      o.transaction_type === input.side &&
      isChaseWorkingBrokerStatus(o.status)
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
  if (input.paperBook) return ledgerHit
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
