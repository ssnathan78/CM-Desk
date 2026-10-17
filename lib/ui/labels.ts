const CODE_LABELS: Record<string, string> = {
  ATM_STRADDLE: "ATM straddle",
  ATM_STRANGLE: "ATM strangle",
  CHASE: "Chase",
  MOMENTUM: "Momentum",
  DAILY_TREND: "Daily trend",
  NIFTY: "Nifty 50",
  BANKNIFTY: "Bank Nifty",
  FINNIFTY: "FinNifty",
  MIDCPNIFTY: "Midcap Nifty",
  LIVE: "Live",
  PAPER: "Paper",
  MOCK: "Mock",
  RECONCILED: "Reconciled",
  MIGRATED: "Migrated",
  SHORT: "Sell premium (short)",
  LONG: "Buy premium (long)",
  FLAT: "Flat",
  BUY: "Buy",
  SELL: "Sell",
  MIS: "MIS (intraday)",
  NRML: "NRML (carry)",
  MARKET: "Market",
  LIMIT: "Limit",
  SL: "Stop-loss",
  SL_M: "Stop-loss (market)",
  INDIVIDUAL_LEG_SLM_1X: "Fixed SL % per leg",
  NO_SL: "No stop-loss",
  ENTRY: "Entry",
  EXIT: "Exit",
  HEDGE: "Hedge",
  SQUARE_OFF: "Square off",
  FLATTEN: "Flatten",
  OTHER: "Other",
  OPEN: "Open",
  CLOSED: "Closed",
  WORKING: "Working",
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  COMPLETE: "Complete",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  FAILED: "Failed",
  PARTIAL: "Partially filled",
  FILLED: "Filled",
  INVALID_QTY: "Invalid quantity",
  LIVE_BLOCKED: "Live blocked",
  DESK_HALTED: "Desk halted",
  TRADING_DISABLED: "Trading disabled",
  STRATEGY_DISABLED: "Strategy disabled",
  STRATEGY_HALTED: "Strategy halted",
  JOB_ABORTED: "Job aborted",
  MARKET_CLOSED: "Market closed",
  INVALID_PRICE: "Invalid price",
  STALE_DATA: "Stale price",
  MAX_QTY: "Max quantity",
  MAX_LOTS: "Max lots",
  MAX_NOTIONAL: "Max notional",
  MAX_POSITIONS: "Max positions",
  MAX_OPEN_ORDERS: "Max open orders",
  ORDER_RATE: "Order rate",
  DUPLICATE: "Duplicate order",
  CHASE_OTHER_BOOK: "Other book open",
  OTHER_BOOK: "Other book open",
  SIGNAL_GENERATED: "Signal generated",
  SIGNAL_ACCEPTED: "Signal accepted",
  SIGNAL_REJECTED: "Signal rejected",
  RISK_CHECK_PASSED: "Risk check passed",
  RISK_CHECK_FAILED: "Risk check failed",
  ORDER_CREATED: "Order created",
  ORDER_SUBMITTED: "Order submitted",
  ORDER_ACCEPTED: "Order accepted",
  ORDER_REJECTED: "Order rejected",
  FILL_RECEIVED: "Fill received",
  PARTIAL_FILL: "Partial fill",
  ORDER_CANCELLED: "Order cancelled",
  POSITION_OPENED: "Position opened",
  POSITION_INCREASED: "Position increased",
  POSITION_REDUCED: "Position reduced",
  POSITION_CLOSED: "Position closed",
  STRATEGY_PAUSED: "Strategy paused",
  STRATEGY_RESUMED: "Strategy resumed",
  RISK_LIMIT_TRIGGERED: "Risk limit triggered",
  KILL_SWITCH: "Kill switch",
  RECONCILIATION_MISMATCH: "Reconciliation mismatch",
  RECONCILIATION_COMPLETED: "Reconciliation completed",
  BROKER_ERROR: "Broker error",
  MANUAL_INTERVENTION: "Manual intervention",
  JOB_REJECTED: "Job rejected",
  JOB_FAILED: "Job failed",
  JOB_DISCARDED: "Job discarded",
  CREATED: "Created",
  POSITION_MISMATCH: "Position mismatch",
  MISSING_ORDER: "Missing order",
  UNEXPECTED_ORDER: "Unexpected order",
  FILL_MISMATCH: "Fill mismatch",
  STALE_PENDING: "Stale pending order",
  UNKNOWN_BROKER_ORDER: "Unknown broker order",
  AVG_PRICE: "Average price mismatch",
  EMA_COMPARE: "EMA compare",
  SKEW_SAMPLE: "Skew sample",
  STRIKE_SELECT: "Strike select",
  SL_UPDATE: "Stop update",
  STATE: "State change",
  SIGNAL_HOLD: "Hold",
  SIGNAL_WAIT: "Waiting",
  SIGNAL_ENTER: "Enter",
  SIGNAL_SKIP: "Skipped",
  SIGNAL_ADJUST: "Adjust",
  SIGNAL_INVALID: "Invalid",
}

/** Title-case unknown SNAKE_CASE for operator-readable tables. */
export function humanizeCode(code: string): string {
  const key = String(code ?? "").trim()
  if (!key) return ""
  return key
    .split("_")
    .filter(Boolean)
    .map(word => {
      if (word.length <= 3 && word === word.toUpperCase()) return word
      const lower = word.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

export function labelFor(code: string | null | undefined): string {
  const key = String(code ?? "").trim()
  if (!key) return ""
  return CODE_LABELS[key] ?? humanizeCode(key)
}

export function isKnownCode(code: string): boolean {
  return code in CODE_LABELS
}
