import { CHASE_STATUS } from "./constants"

const UNDERLYING = /^[A-Z][A-Z0-9]{0,19}$/
const FUT_SYMBOL =
  /^([A-Z][A-Z0-9]{0,19}?)(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT)$/

const OPEN_STATUS = new Set<string>([
  CHASE_STATUS.LONG,
  CHASE_STATUS.SHORT,
  CHASE_STATUS.AWAITING_LONG,
  CHASE_STATUS.AWAITING_SHORT,
])

/** Kite NFO `name`. Rejects blank, lowercase, and symbols. */
export function normalizeChaseUnderlying(raw: unknown): string | null {
  const name = String(raw ?? "")
    .trim()
    .toUpperCase()
  if (!UNDERLYING.test(name) || FUT_SYMBOL.test(name)) return null
  return name
}

/**
 * Underlying encoded on a futures tradingsymbol.
 * RELIANCE26OCTFUT → RELIANCE. Unknown shapes return null. Never guess NIFTY.
 */
export function chaseUnderlyingFromSymbol(symbol: string | null | undefined): string | null {
  const upper = String(symbol ?? "")
    .trim()
    .toUpperCase()
  const match = FUT_SYMBOL.exec(upper)
  return match ? match[1] : null
}

export function chaseStatusNeedsManagement(status: string | null | undefined): boolean {
  return OPEN_STATUS.has(status ?? "")
}

/**
 * What this book may ask Kite for.
 * Hourly candles and signals run only when Trade this book is on.
 * The minute job runs for an open or pending book even when that switch is off,
 * and does not run for a book that is off and flat.
 */
export function chaseBookMarketAccess(input: { enabled: boolean; status?: string | null }): {
  hourlyCandles: boolean
  signals: boolean
  minuteJob: boolean
} {
  const minuteJob = input.enabled || chaseStatusNeedsManagement(input.status)
  return {
    hourlyCandles: input.enabled,
    signals: input.enabled,
    minuteJob,
  }
}

export function chaseRemoveBlockReason(
  status: string | null | undefined,
  netQty: number
): string | null {
  if (chaseStatusNeedsManagement(status)) {
    return "This book is open or waiting on an entry. Square it off before removing it."
  }
  if (Number.isFinite(netQty) && netQty !== 0) {
    return "This book still has quantity. Square it off before removing it."
  }
  return null
}

export type FuturesNameRow = {
  name?: string | null
  instrument_type?: string | null
  expiry?: string | Date | null
}

/** Distinct underlyings that still have an unexpired future in a cached instrument dump. */
export function futuresUnderlyingNames(rows: FuturesNameRow[], now = new Date()): string[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const names = new Set<string>()
  for (const row of rows) {
    if (String(row.instrument_type || "").toUpperCase() !== "FUT") continue
    const name = normalizeChaseUnderlying(row.name)
    if (!name) continue
    if (row.expiry) {
      const expiry = new Date(row.expiry)
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < today.getTime()) continue
    }
    names.add(name)
  }
  return [...names].sort()
}

export function searchFuturesUnderlyings(names: string[], query: string, limit = 15): string[] {
  const q =
    normalizeChaseUnderlying(query) ??
    String(query || "")
      .trim()
      .toUpperCase()
  if (!q) return names.slice(0, limit)
  return names.filter(name => name.includes(q)).slice(0, limit)
}
