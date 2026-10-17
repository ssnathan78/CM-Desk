export type DeskDeepLink = {
  pathname: string
  query: Record<string, string>
}

type AlertLike = {
  source: string
  code: string
  strategy?: string | null
  jobId?: string | null
  orderId?: string | null
  instrument?: string | null
}

const RISK_CODES = new Set([
  "MAX_NOTIONAL",
  "MAX_LOTS",
  "MAX_POSITIONS",
  "LIVE_BLOCKED",
  "DESK_HALTED",
  "TRADING_DISABLED",
  "STRATEGY_DISABLED",
  "STRATEGY_HALTED",
  "CHASE_OTHER_BOOK",
  "OTHER_BOOK",
  "RISK_UNAVAILABLE",
])

export function alertTarget(alert: AlertLike): DeskDeepLink {
  if (alert.source === "RECON" || alert.code === "RECONCILIATION_MISMATCH") {
    return { pathname: "/desk", query: { view: "setup", tab: "broker" } }
  }
  if (alert.source === "RISK" || RISK_CODES.has(alert.code)) {
    return { pathname: "/desk", query: { view: "why", tab: "decisions" } }
  }
  if (alert.orderId) {
    const query: Record<string, string> = { view: "books", tab: "orders", orderId: alert.orderId }
    return { pathname: "/desk", query }
  }
  if (alert.jobId) {
    return {
      pathname: "/desk",
      query: { view: "why", tab: "signals", jobId: alert.jobId },
    }
  }
  if (alert.source === "CHASE" || alert.code.startsWith("CHASE_")) {
    const query: Record<string, string> = { view: "setup", tab: "broker" }
    if (alert.instrument) query.instrument = alert.instrument
    return { pathname: "/desk", query }
  }
  if (alert.strategy === "CHASE") {
    return { pathname: "/chase", query: {} }
  }
  if (alert.source === "SCHEDULE" || alert.source === "JOB") {
    return { pathname: "/desk", query: { view: "now", tab: "today" } }
  }
  return { pathname: "/desk", query: { view: "why", tab: "alerts" } }
}

export function hrefForDeskLink(link: DeskDeepLink): string {
  const qs = new URLSearchParams(link.query).toString()
  return qs ? `${link.pathname}?${qs}` : link.pathname
}
