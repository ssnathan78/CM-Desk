import { getKiteInstance } from "./kiteUtils"

/** NSE cash symbols such as RELIANCE, NIFTYBEES, and M&M. A leading digit is not a symbol. */
export const NSE_CASH_SYMBOL = /^[A-Z][A-Z0-9&-]{0,19}$/

export function normalizeNseCashSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase()
  if (!NSE_CASH_SYMBOL.test(symbol)) return null
  return symbol
}

let listedCache: { at: number; symbols: Set<string> } | null = null

export async function listedNseCashSymbols(accessToken?: string | null): Promise<Set<string>> {
  if (listedCache && Date.now() - listedCache.at < 6 * 60 * 60 * 1000) return listedCache.symbols
  const kite = getKiteInstance(accessToken || undefined)
  const rows = (await kite.getInstruments("NSE")) as Array<{
    tradingsymbol?: string
    instrument_type?: string
  }>
  const symbols = new Set<string>()
  for (const row of rows) {
    if (row.instrument_type === "EQ" && row.tradingsymbol) symbols.add(row.tradingsymbol)
  }
  listedCache = { at: Date.now(), symbols }
  return symbols
}

export async function requireListedNseCash(
  raw: string,
  accessToken?: string | null
): Promise<{ ok: true; symbol: string } | { ok: false; error: string }> {
  const symbol = normalizeNseCashSymbol(raw)
  if (!symbol) {
    return { ok: false, error: "Symbol must look like an NSE cash symbol, such as RELIANCE or M&M" }
  }
  try {
    const listed = await listedNseCashSymbols(accessToken)
    if (!listed.has(symbol)) {
      return { ok: false, error: `${symbol} is not an NSE cash symbol` }
    }
    return { ok: true, symbol }
  } catch {
    return { ok: false, error: "Could not check the NSE instrument list. Try again in a moment." }
  }
}
