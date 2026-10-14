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

export type CashPullScope = "trend" | "momentum" | "all"

export type CashPullProgress = {
  running: boolean
  done: number
  total: number
  symbol: string | null
  errors: number
  message: string | null
  shown: boolean
}

const idlePull: CashPullProgress = {
  running: false,
  done: 0,
  total: 0,
  symbol: null,
  errors: 0,
  message: null,
  shown: false,
}

let pullProgress: CashPullProgress = { ...idlePull }
let pullActive: Promise<{
  skipped: boolean
  reason?: string
  pulled: number
  errors: string[]
}> | null = null

export function cashPullProgress(): CashPullProgress {
  return { ...pullProgress }
}

/** Text for a pull that found no names. The hourly skip is not shown on the page. */
export function emptyPullMessage(input: {
  scope: CashPullScope
  trendActive: boolean
  momentumActive: boolean
}): string {
  if (input.scope === "trend" && !input.trendActive)
    return "Daily trend is off. Turn it on, save, then use Pull history now."
  if (input.scope === "momentum" && !input.momentumActive)
    return "Momentum is off. Turn Strategy on, save, then use Pull history now."
  if (input.scope === "trend") return "There are no symbols on the daily-trend page."
  if (input.scope === "momentum") return "The momentum list is empty."
  return "No download is due. Pull data daily is off, or today's candles were already downloaded."
}
export function symbolsForCashPull(input: {
  scope: CashPullScope
  force: boolean
  today: string
  momentum: { active: boolean; dataRefresh: boolean; lastDataPullOn: string | null }
  trend: { active: boolean; dataRefresh: boolean; lastDataPullOn: string | null }
  universe: string[]
  trendBooks: { symbol: string; enabled: boolean }[]
}): { symbols: string[]; momentumDue: boolean; trendDue: boolean } {
  const momentumDue =
    input.scope !== "trend" &&
    input.momentum.active &&
    (input.force || (input.momentum.dataRefresh && input.momentum.lastDataPullOn !== input.today))
  const trendDue =
    input.scope !== "momentum" &&
    input.trend.active &&
    (input.scope === "trend" ||
      input.force ||
      (input.trend.dataRefresh && input.trend.lastDataPullOn !== input.today))
  const symbols = new Set<string>()
  if (momentumDue) {
    for (const symbol of input.universe) symbols.add(symbol)
  }
  if (trendDue) {
    for (const book of input.trendBooks) {
      if (input.scope === "trend" || book.enabled) symbols.add(book.symbol)
    }
  }
  return { symbols: [...symbols], momentumDue, trendDue }
}

export function startCashHistoryPull(args: {
  accessToken?: string | null
  force?: boolean
  scope: CashPullScope
}): { started: boolean; progress: CashPullProgress } {
  if (pullActive) return { started: false, progress: cashPullProgress() }
  pullProgress = {
    running: true,
    done: 0,
    total: 0,
    symbol: null,
    errors: 0,
    message: "Starting the history pull",
    shown: true,
  }
  const run = pullCashHistoryNow(args).finally(() => {
    pullActive = null
  })
  pullActive = run
  return { started: true, progress: cashPullProgress() }
}

export async function pullCashHistory(args: {
  accessToken?: string | null
  force?: boolean
  scope?: CashPullScope
}): Promise<{ skipped: boolean; reason?: string; pulled: number; errors: string[] }> {
  if (pullActive) {
    return { skipped: true, reason: "a history pull is already running", pulled: 0, errors: [] }
  }
  const run = pullCashHistoryNow(args).finally(() => {
    pullActive = null
  })
  pullActive = run
  return run
}

async function pullCashHistoryNow(args: {
  accessToken?: string | null
  force?: boolean
  scope?: CashPullScope
}): Promise<{ skipped: boolean; reason?: string; pulled: number; errors: string[] }> {
  const momentum = await getMomentumState()
  const trend = await getDailyTrendState()
  const today = istDate(new Date())
  const scope = args.scope ?? "all"
  const planned = symbolsForCashPull({
    scope,
    force: args.force === true,
    today,
    momentum: {
      active: momentum.config.active,
      dataRefresh: momentum.config.dataRefresh,
      lastDataPullOn: momentum.lastDataPullOn,
    },
    trend: {
      active: trend.config.active,
      dataRefresh: trend.config.dataRefresh,
      lastDataPullOn: trend.lastDataPullOn,
    },
    universe: (await listUniverse()).map(row => row.symbol),
    trendBooks: (await listDailyTrendBooks()).map(book => ({
      symbol: book.symbol,
      enabled: book.enabled,
    })),
  })
  const requested = args.force === true || scope === "trend" || scope === "momentum"
  if (!planned.symbols.length) {
    const message = emptyPullMessage({
      scope,
      trendActive: trend.config.active,
      momentumActive: momentum.config.active,
    })
    if (requested) {
      pullProgress = {
        running: false,
        done: 0,
        total: 0,
        symbol: null,
        errors: 0,
        message,
        shown: true,
      }
    }
    return { skipped: true, reason: message, pulled: 0, errors: [] }
  }
  const token = args.accessToken || (await getLatestAccessToken())
  if (!token) {
    const message = "No Kite session. Log in, then use Pull history now."
    if (requested) {
      pullProgress = {
        running: false,
        done: 0,
        total: 0,
        symbol: null,
        errors: 0,
        message,
        shown: true,
      }
    }
    return { skipped: true, reason: "no Kite session", pulled: 0, errors: [] }
  }

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
  pullProgress = {
    running: true,
    done: 0,
    total: planned.symbols.length,
    symbol: null,
    errors: 0,
    message: `Pulling 0 of ${planned.symbols.length}`,
    shown: true,
  }
  for (const symbol of planned.symbols) {
    pullProgress = {
      ...pullProgress,
      symbol,
      message: `Pulling ${symbol} — ${pulled} of ${planned.symbols.length}`,
    }
    const instrumentToken = tokenBySymbol.get(symbol)
    if (!instrumentToken) {
      errors.push(`${symbol}: not in the NSE instrument dump`)
      pullProgress = { ...pullProgress, errors: errors.length }
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
    pullProgress = {
      running: true,
      done: pulled,
      total: planned.symbols.length,
      symbol,
      errors: errors.length,
      message: `Pulling ${symbol} — ${pulled} of ${planned.symbols.length}`,
      shown: true,
    }
    await sleep(350)
  }
  if (planned.momentumDue) await markMomentumPull(today)
  if (planned.trendDue) await markDailyTrendPull(today)
  const message = errors.length
    ? `Pulled ${pulled} of ${planned.symbols.length}. ${errors.length} failed.`
    : `Pulled ${pulled} names`
  pullProgress = {
    running: false,
    done: pulled,
    total: planned.symbols.length,
    symbol: null,
    errors: errors.length,
    message,
    shown: true,
  }
  return { skipped: false, pulled, errors }
}
