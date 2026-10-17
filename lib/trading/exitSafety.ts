import { LIVE_FLATTEN_MARKET_CLOSED } from "../flattenNotice"
import { isPaperStrategy, type RiskSettings } from "./riskEngine"

export const SQUARE_OFF_STRATEGY_REQUIRED =
  "Square-off has no strategy, so the paper and live books cannot be told apart."

export type SquareOffBook =
  | { action: "paper" }
  | { action: "live" }
  | { action: "refuse"; reason: string }

/**
 * A missing strategy used to follow two different defaults: one path treated it
 * as paper, the other sized from Kite and then stored a paper fill. Both are
 * refused. Mock mode stays on the paper book.
 */
export function resolveSquareOffBook(input: {
  processMock: boolean
  strategy?: string | null
  settings: RiskSettings
}): SquareOffBook {
  if (input.processMock) return { action: "paper" }
  const strategy = (input.strategy || "").trim()
  if (!strategy) return { action: "refuse", reason: SQUARE_OFF_STRATEGY_REQUIRED }
  if (isPaperStrategy(input.settings, strategy)) return { action: "paper" }
  return { action: "live" }
}

type TaggedOrder = {
  tag?: string | null
  product?: string | null
  exchange?: string | null
  tradingsymbol?: string | null
  quantity?: number | null
}

/** Cancel only this job's protective order. Same symbol and quantity is not enough. */
export function protectiveOrderMatchesJob(jobOrder: TaggedOrder, openOrder: TaggedOrder): boolean {
  if (!jobOrder.tag || openOrder.tag !== jobOrder.tag) return false
  return (
    openOrder.product === jobOrder.product &&
    openOrder.exchange === jobOrder.exchange &&
    openOrder.tradingsymbol === jobOrder.tradingsymbol &&
    Math.abs(Number(openOrder.quantity)) === Math.abs(Number(jobOrder.quantity))
  )
}

/**
 * Chase may convert or resize its own stop. A blank tag is a legacy Chase order.
 * Any other tag belongs to another strategy and is left alone.
 */
export function chaseMayTouchBrokerStop(tag?: string | null): boolean {
  const value = (tag || "").trim().toLowerCase()
  return value === "" || value === "chase"
}

export type ChaseRolloverGate = {
  flatten: "paper" | "live" | "skip"
  /** Paper rollover must not read, cancel, or modify a Kite order. */
  touchKite: boolean
  reason: string | null
}

/** Flatten the front month before the next-month entry. A skip leaves both untouched. */
export function planChaseRollover(input: {
  paperBook: boolean
  marketOpen: boolean
  strategyEnabled: boolean
}): ChaseRolloverGate {
  if (!input.strategyEnabled) {
    return {
      flatten: "skip",
      touchKite: false,
      reason: "Chase is disabled. The front month and its stop stay.",
    }
  }
  if (input.paperBook) return { flatten: "paper", touchKite: false, reason: null }
  if (!input.marketOpen) {
    return { flatten: "skip", touchKite: false, reason: LIVE_FLATTEN_MARKET_CLOSED }
  }
  return { flatten: "live", touchKite: true, reason: null }
}
