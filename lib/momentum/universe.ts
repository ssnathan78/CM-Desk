import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { normalizeNseCashSymbol } from "../nseCashSymbol"

export type UniverseRow = {
  symbol: string
  name: string
  series: string
}

export function parseUniverseCsv(text: string): UniverseRow[] {
  const rows: UniverseRow[] = []
  const seen = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("Company Name")) continue
    const parts = trimmed.split(",")
    if (parts.length < 4) continue
    const symbol = normalizeNseCashSymbol(parts[2] || "")
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    rows.push({
      symbol,
      name: parts[0]?.trim() || symbol,
      series: parts[3]?.trim().toUpperCase() || "EQ",
    })
  }
  return rows
}

export function loadBundledUniverse(): UniverseRow[] {
  const path = resolve(process.cwd(), "data/universe/nifty-total-market.csv")
  return parseUniverseCsv(readFileSync(path, "utf8"))
}
