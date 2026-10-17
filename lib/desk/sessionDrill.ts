export function tradesDrillQuery(sessionDate: string): Record<string, string> {
  return {
    view: "books",
    tab: "trades",
    from: sessionDate,
    to: sessionDate,
  }
}
