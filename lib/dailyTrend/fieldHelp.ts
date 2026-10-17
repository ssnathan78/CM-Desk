export const DAILY_TREND_FIELD_HELP = {
  bulkEma: "EMA period for the signal. Applied with Save selected or Apply to all when filled.",
  bulkBuffer: "Entry buffer % above EMA. Blank leaves each symbol unchanged.",
  bulkExit: "Exit buffer % for the stop. Blank leaves unchanged.",
  bulkBudget: "Rupees budget per symbol; share count uses last completed close.",
  bulkEntry: "Close cross vs break-high entry style. Blank leaves unchanged.",
  filter:
    "Narrows the book table below. Matches symbol, company name, or industry (case insensitive).",
  signalView:
    "Qualifies shows names above the band, including Wait for the high and budget 0. It is not the same as a Buy chip.",
  addSymbol:
    "Search NSE cash symbols to add a new book row (starts with engine off until you turn it on).",
} as const
