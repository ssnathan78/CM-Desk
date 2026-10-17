export type DeskView = "now" | "books" | "why" | "setup"

export type DeskTab =
  | "today"
  | "positions"
  | "orders"
  | "trades"
  | "sessions"
  | "alerts"
  | "signals"
  | "decisions"
  | "activity"
  | "lists"
  | "contracts"
  | "broker"
  | "maintenance"

const BOOKS: DeskTab[] = ["positions", "orders", "trades", "sessions"]
const WHY: DeskTab[] = ["alerts", "signals", "decisions", "activity"]
const SETUP: DeskTab[] = ["broker", "contracts", "lists", "maintenance"]

export function viewForTab(tab: DeskTab): DeskView {
  if (tab === "today") return "now"
  if (BOOKS.includes(tab)) return "books"
  if (WHY.includes(tab)) return "why"
  return "setup"
}

export function defaultTabForView(view: DeskView): DeskTab {
  switch (view) {
    case "now":
      return "today"
    case "books":
      return "positions"
    case "why":
      return "alerts"
    case "setup":
      return "broker"
  }
}

export function tabsForView(view: DeskView): DeskTab[] {
  switch (view) {
    case "now":
      return ["today"]
    case "books":
      return BOOKS
    case "why":
      return WHY
    case "setup":
      return SETUP
  }
}

export function migrateLegacyTab(tab: string | undefined): { view: DeskView; tab: DeskTab } {
  if (tab === "risk") return { view: "setup", tab: "broker" }
  if (tab === "today" || !tab) return { view: "now", tab: "today" }
  const known = tab as DeskTab
  if (
    [
      "positions",
      "orders",
      "trades",
      "sessions",
      "alerts",
      "signals",
      "decisions",
      "activity",
      "lists",
      "contracts",
      "broker",
    ].includes(known)
  ) {
    return { view: viewForTab(known), tab: known }
  }
  return { view: "now", tab: "today" }
}

export function parseDeskRoute(query: { view?: string | string[]; tab?: string | string[] }): {
  view: DeskView
  tab: DeskTab
} {
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  if (rawView === "now" || rawView === "books" || rawView === "why" || rawView === "setup") {
    const tabs = tabsForView(rawView)
    const tab = tabs.includes(rawTab as DeskTab) ? (rawTab as DeskTab) : defaultTabForView(rawView)
    return { view: rawView, tab }
  }
  return migrateLegacyTab(rawTab)
}
