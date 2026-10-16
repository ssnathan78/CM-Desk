import { normalizeNseCashSymbol } from "../nseCashSymbol"

export type IndexCode = "NIFTY100" | "NIFTY_TOTAL_MARKET"

export type Constituent = {
  symbol: string
  name: string
  series: string
}

export type MembershipChange = {
  indexCode: IndexCode
  symbol: string
  name: string
  action: "ADD" | "REMOVE"
  note: string
}

export type MembershipPlan = {
  apply: boolean
  autoAddBooks: Constituent[]
  pending: MembershipChange[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function splitCsvLine(line: string): string[] {
  const parts: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else quoted = !quoted
      continue
    }
    if (ch === "," && !quoted) {
      parts.push(current)
      current = ""
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts
}

/** True when the snapshot is missing or at least `days` old. */
export function membershipStale(asOf: string | null, today: string, days = 7): boolean {
  if (!asOf) return true
  const previous = Date.parse(`${asOf}T00:00:00Z`)
  const current = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return true
  return current - previous >= days * DAY_MS
}

/** Official Nifty Indices files and the bundled snapshots share this column order. */
export function parseConstituentCsv(text: string): Constituent[] {
  const rows: Constituent[] = []
  const seen = new Set<string>()
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("Company Name")) continue
    const parts = splitCsvLine(trimmed)
    if (parts.length < 5) continue
    if (parts.length > 5) parts.pop()
    parts.pop()
    const series = (parts.pop() || "EQ").trim().toUpperCase()
    const symbol = normalizeNseCashSymbol(parts.pop() || "")
    parts.pop()
    if (!symbol || !series || seen.has(symbol)) continue
    seen.add(symbol)
    rows.push({ symbol, name: parts.join(",").trim() || symbol, series })
  }
  return rows
}

export function constituentRemovalNote(
  indexCode: IndexCode,
  symbol: string,
  flags: MembershipFlags
): string {
  const bits: string[] = []
  if (flags.openSymbols.has(symbol)) bits.push("open quantity")
  if (flags.locks.has(symbol)) bits.push("a weight lock")
  if (flags.books.has(symbol)) bits.push("a daily-trend book")
  const held = bits.length ? ` Still has ${bits.join(", ")}.` : ""
  if (indexCode === "NIFTY_TOTAL_MARKET") {
    return `Accept removes it from the rank list and does not sell now. The next rebalance sells the open quantity if the name is gone.${held}`
  }
  return `Accept removes the daily-trend book and does not sell.${held} The stop for this symbol stops with the book.`
}

type MembershipFlags = {
  universe: Set<string>
  books: Set<string>
  locks: Set<string>
  openSymbols: Set<string>
}

/**
 * Diff a downloaded constituent file against the stored snapshot.
 * An empty file does not apply. Nifty 100 names missing a book are auto-added off.
 * Total-market adds and every removal wait for accept.
 */
export function planMembershipDiff(input: {
  indexCode: IndexCode
  incoming: Constituent[]
  previous: string[]
  universe: string[]
  books: string[]
  locks: string[]
  openSymbols: string[]
}): MembershipPlan {
  if (!input.incoming.length) return { apply: false, autoAddBooks: [], pending: [] }
  const flags: MembershipFlags = {
    universe: new Set(input.universe),
    books: new Set(input.books),
    locks: new Set(input.locks),
    openSymbols: new Set(input.openSymbols),
  }
  const previous = new Set(input.previous)
  const incomingSymbols = new Set(input.incoming.map(row => row.symbol))
  const autoAddBooks: Constituent[] = []
  const pending: MembershipChange[] = []

  for (const row of input.incoming) {
    if (previous.has(row.symbol)) continue
    if (input.indexCode === "NIFTY100") {
      if (!flags.books.has(row.symbol)) autoAddBooks.push(row)
      continue
    }
    if (!flags.universe.has(row.symbol)) {
      pending.push({
        indexCode: input.indexCode,
        symbol: row.symbol,
        name: row.name,
        action: "ADD",
        note: "Accept adds it to the rank list. A later rebalance can buy it if it ranks in.",
      })
    }
  }

  for (const symbol of previous) {
    if (incomingSymbols.has(symbol)) continue
    pending.push({
      indexCode: input.indexCode,
      symbol,
      name: symbol,
      action: "REMOVE",
      note: constituentRemovalNote(input.indexCode, symbol, flags),
    })
  }

  return { apply: true, autoAddBooks, pending }
}

/**
 * Names you already keep that are absent from a downloaded file.
 * An empty snapshot returns nothing, so a failed download cannot queue a wipe.
 * `alreadyTracked` includes dismissed removals so they are not asked again.
 */
/**
 * A bundled copy may seed an empty snapshot. It must not replace a file already stored,
 * or Refresh proposes the old copy as a new index change.
 */
export function membershipFileApplies(
  source: "remote" | "bundled",
  existingCount: number
): boolean {
  if (source === "remote") return true
  return existingCount === 0
}

export function symbolsMissingFromSnapshot(
  owned: string[],
  snapshot: string[],
  alreadyTracked: string[]
): string[] {
  if (!snapshot.length) return []
  const present = new Set(snapshot)
  const tracked = new Set(alreadyTracked)
  return owned.filter(symbol => !present.has(symbol) && !tracked.has(symbol)).sort()
}
