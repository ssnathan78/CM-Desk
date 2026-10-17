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
  MIS: "MIS (intraday)",
  NRML: "NRML (carry)",
  INDIVIDUAL_LEG_SLM_1X: "Fixed SL % per leg",
  NO_SL: "No stop-loss",
  ENTRY: "Entry",
  SQUARE_OFF: "Square off",
  SL: "Stop-loss",
  EXIT: "Exit",
  HEDGE: "Hedge",
  OTHER: "Other",
}

export function labelFor(code: string | null | undefined): string {
  const key = String(code ?? "").trim()
  if (!key) return ""
  return CODE_LABELS[key] ?? key
}

export function isKnownCode(code: string): boolean {
  return code in CODE_LABELS
}
