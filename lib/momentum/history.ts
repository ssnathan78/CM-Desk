import dayjs from "dayjs"

import { getLatestAccessToken } from "../drizzleDbUtils"
import { getKiteInstance } from "../kiteUtils"
import logger from "../logger"
import { istDate } from "./calendar"
import type { DailyBar } from "./engine"
import {
  getDailyTrendState,
  getMomentumState,
  listDailyTrendBooks,
  listUniverse,
  markDailyTrendPull,
  markMomentumPull,
  upsertBars,
} from "./store"
import { dataPullAllowed } from "./types"

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function asBars(candles: Array<Record<string, unknown>>): DailyBar[] {
  return candles
    .map(candle => {
      const date = dayjs(String(candle.date)).format("YYYY-MM-DD")
      return {
        date,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume ?? 0),
      }
    })
    .filter(bar => bar.date && bar.close > 0)
}

export async function pullCashHistory(args: {
  accessToken?: string | null
  force?: boolean
}): Promise<{ skipped: boolean; reason?: string; pulled: number; errors: string[] }> {
  const momentum = await getMomentumState()
  const trend = await getDailyTrendState()
  const today = istDate(new Date())
  const symbols = new Set<string>()
  const momentumDue =
    momentum.config.active &&
    (args.force || dataPullAllowed(momentum.config)) &&
    (args.force || momentum.lastDataPullOn !== today)
  const trendDue =
    trend.config.active &&
    (args.force || trend.config.dataRefresh) &&
    (args.force || trend.lastDataPullOn !== today)
  if (!momentum.config.active && !trend.config.active) {
    return { skipped: true, reason: "both strategies are off", pulled: 0, errors: [] }
  }
  if (momentumDue) {
    for (const row of await listUniverse()) symbols.add(row.symbol)
  }
  if (trendDue) {
    for (const book of await listDailyTrendBooks()) {
      if (book.enabled) symbols.add(book.symbol)
    }
  }
  if (!symbols.size) return { skipped: true, reason: "nothing due", pulled: 0, errors: [] }
  const token = args.accessToken || (await getLatestAccessToken())
  if (!token) return { skipped: true, reason: "no Kite session", pulled: 0, errors: [] }

  const kite = getKiteInstance(token)
  const instruments = await kite.getInstruments("NSE")
  const tokenBySymbol = new Map<string, number>()
  for (const row of instruments as unknown as Array<{
    tradingsymbol?: string
    instrument_token?: number
  }>) {
    if (row.tradingsymbol && row.instrument_token)
      tokenBySymbol.set(row.tradingsymbol, row.instrument_token)
  }
  const from = dayjs().subtract(1100, "day").toDate()
  const to = new Date()
  let pulled = 0
  const errors: string[] = []
  for (const symbol of symbols) {
    const instrumentToken = tokenBySymbol.get(symbol)
    if (!instrumentToken) {
      errors.push(`${symbol}: not in the NSE instrument dump`)
      continue
    }
    try {
      const candles = await kite.getHistoricalData(instrumentToken, "day", from, to)
      const bars = asBars(Array.isArray(candles) ? candles : [])
      await upsertBars(symbol, bars)
      pulled += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${symbol}: ${message}`)
      logger.warn(`[cashHistory] ${symbol}`, error)
    }
    await sleep(350)
  }
  if (momentumDue) await markMomentumPull(today)
  if (trendDue) await markDailyTrendPull(today)
  return { skipped: false, pulled, errors }
}
