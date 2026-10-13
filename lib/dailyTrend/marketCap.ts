import logger from "../logger"
import { istDate } from "../momentum/calendar"
import {
  listDailyTrendBooks,
  marketCapsDue,
  saveMarketCap,
  seedMarketCapsFromList,
} from "../momentum/store"
import { loadNifty100, NIFTY100_MARKET_CAP_AS_OF } from "./nifty100"

export function parseScreenerMarketCapCr(html: string): number | null {
  const match = html.match(/Market Cap[\s\S]{0,400}?<span class="number">([^<]+)<\/span>/)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, "").trim())
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

async function fetchScreenerMarketCap(symbol: string): Promise<number | null> {
  const response = await fetch(`https://www.screener.in/company/${encodeURIComponent(symbol)}/`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
  })
  if (!response.ok) return null
  return parseScreenerMarketCapCr(await response.text())
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function seedKnownMarketCaps(): Promise<void> {
  await seedMarketCapsFromList(loadNifty100(), NIFTY100_MARKET_CAP_AS_OF)
}

export async function refreshStaleMarketCaps(
  limit = 20
): Promise<{ updated: number; failed: number }> {
  const today = istDate(new Date())
  await seedKnownMarketCaps()
  const books = await listDailyTrendBooks()
  await seedMarketCapsFromList(
    books.map(book => ({
      symbol: book.symbol,
      name: book.symbol,
      industry: "",
      marketCapCr: null,
    })),
    today
  )
  const due = await marketCapsDue(today, limit)
  let updated = 0
  let failed = 0
  for (const symbol of due) {
    try {
      const marketCapCr = await fetchScreenerMarketCap(symbol)
      if (marketCapCr == null) failed += 1
      else {
        await saveMarketCap({ symbol, marketCapCr, asOf: today })
        updated += 1
      }
    } catch (error) {
      failed += 1
      logger.warn(`[marketCap] ${symbol}`, error)
    }
    await sleep(1500)
  }
  return { updated, failed }
}
