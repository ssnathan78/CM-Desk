import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { normalizeNseCashSymbol } from "../nseCashSymbol"

export type Nifty100Row = {
  symbol: string
  name: string
  industry: string
  marketCapCr: number | null
}

/** Screener snapshot joined onto the Nifty Indices constituent file. Not a live quote. */
export const NIFTY100_MARKET_CAP_AS_OF = "2026-10-13"

export function parseNifty100Csv(text: string): Nifty100Row[] {
  const rows: Nifty100Row[] = []
  const seen = new Set<string>()
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("Company Name")) continue
    const parts = trimmed.split(",")
    if (parts.length < 5) continue
    const marketCapRaw = parts.length > 5 ? parts.pop() : ""
    const isin = parts.pop()
    const series = parts.pop()
    const symbol = normalizeNseCashSymbol(parts.pop() || "")
    const industry = parts.pop()?.trim() || ""
    if (!symbol || !isin || !series || seen.has(symbol)) continue
    seen.add(symbol)
    const marketCapCr = Number(String(marketCapRaw).replace(/,/g, ""))
    rows.push({
      symbol,
      name: parts.join(",").trim() || symbol,
      industry,
      marketCapCr: Number.isFinite(marketCapCr) && marketCapCr > 0 ? marketCapCr : null,
    })
  }
  return rows
}

export function loadNifty100(): Nifty100Row[] {
  const path = resolve(process.cwd(), "data/universe/nifty-100.csv")
  return parseNifty100Csv(readFileSync(path, "utf8"))
}
