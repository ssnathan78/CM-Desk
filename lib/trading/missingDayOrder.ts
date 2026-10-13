import { istTodayBounds } from "./feedWindow"
import { OPEN_ORDER_STATUSES, type OrderStatus } from "./types"

/** Ledger reason when a prior-session DAY/IOC order is gone from Kite's book. */
export const PRIOR_DAY_MISSING_CANCEL_REASON = "DAY order not in the Kite book after that session"

/**
 * Kite's order book is the current day. A DAY or IOC order last seen before
 * today's IST session, still open here with no fill, cannot still be working.
 * An order touched today stays a warning: this fetch may be incomplete.
 */
export function missingDayOrderShouldExpire(input: {
  status: string
  validity?: string | null
  filledQty?: number | null
  updatedAt: Date
  now?: Date
}): boolean {
  const validity = (input.validity || "").trim().toUpperCase()
  if (validity !== "DAY" && validity !== "IOC") return false
  if ((input.filledQty ?? 0) !== 0) return false
  if (!OPEN_ORDER_STATUSES.includes(input.status as OrderStatus)) return false
  const { start } = istTodayBounds(input.now ?? new Date())
  return input.updatedAt.getTime() < start.getTime()
}
