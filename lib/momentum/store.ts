import { asc, eq, inArray, sql } from "drizzle-orm"
import type { DailyTrendBulkPatch } from "../dailyTrend/engine"
import { loadNifty100 } from "../dailyTrend/nifty100"
import { db } from "../drizzle"
import {
  dailyTrendBooks,
  dailyTrendSettings,
  equityDailyBars,
  equityMarketCaps,
  momentumSettings,
  momentumUniverse,
  momentumWeightLocks,
  positions,
} from "../schema"
import { isPaperStrategy } from "../trading/riskEngine"
import { getRiskSettings } from "../trading/riskSettings"
import { provenanceInBook } from "../trading/types"
import { isMockOrder } from "../utils"
import type { DailyBar, WeightLock } from "./engine"
import { DEFAULT_MOMENTUM_CONFIG, type MomentumConfig, normalizeMomentumConfig } from "./types"
import { loadBundledUniverse } from "./universe"

export type DailyTrendRuntime = {
  active: boolean
  dataRefresh: boolean
  execution: "report" | "manual" | "auto"
  limitBufferPercent: number
}

export const DEFAULT_DAILY_TREND_RUNTIME: DailyTrendRuntime = {
  active: false,
  dataRefresh: false,
  execution: "report",
  limitBufferPercent: 0.15,
}

export function normalizeDailyTrendRuntime(raw: unknown): DailyTrendRuntime {
  const row = raw && typeof raw === "object" ? (raw as Partial<DailyTrendRuntime>) : {}
  const buffer = Number(row.limitBufferPercent)
  return {
    active: row.active === true,
    dataRefresh: row.dataRefresh === true,
    execution: row.execution === "manual" || row.execution === "auto" ? row.execution : "report",
    limitBufferPercent: Number.isFinite(buffer) ? Math.min(5, Math.max(0, buffer)) : 0.15,
  }
}

export type MomentumState = {
  config: MomentumConfig
  lastDataPullOn: string | null
  lastRebalanceOn: string | null
}

export type DailyTrendState = {
  config: DailyTrendRuntime
  lastDataPullOn: string | null
}

function asDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

export async function getMomentumState(): Promise<MomentumState> {
  const [row] = await db.select().from(momentumSettings).where(eq(momentumSettings.id, 1)).limit(1)
  if (!row) {
    await db.insert(momentumSettings).values({ id: 1, config: DEFAULT_MOMENTUM_CONFIG })
    return { config: DEFAULT_MOMENTUM_CONFIG, lastDataPullOn: null, lastRebalanceOn: null }
  }
  return {
    config: normalizeMomentumConfig(row.config),
    lastDataPullOn: asDate(row.lastDataPullOn),
    lastRebalanceOn: asDate(row.lastRebalanceOn),
  }
}

export async function saveMomentumConfig(config: MomentumConfig): Promise<MomentumState> {
  const next = normalizeMomentumConfig(config)
  await db
    .insert(momentumSettings)
    .values({ id: 1, config: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: momentumSettings.id,
      set: { config: next, updatedAt: new Date() },
    })
  return getMomentumState()
}

export async function markMomentumPull(day: string): Promise<void> {
  await db
    .update(momentumSettings)
    .set({ lastDataPullOn: day, updatedAt: new Date() })
    .where(eq(momentumSettings.id, 1))
}

export async function markMomentumRebalance(day: string): Promise<void> {
  await db
    .update(momentumSettings)
    .set({ lastRebalanceOn: day, updatedAt: new Date() })
    .where(eq(momentumSettings.id, 1))
}

export async function listUniverse(): Promise<{ symbol: string; name: string; series: string }[]> {
  const rows = await db.select().from(momentumUniverse)
  const bundled = loadBundledUniverse()
  if (rows.length === 0 && bundled.length) {
    await db
      .insert(momentumUniverse)
      .values(
        bundled.map(row => ({
          tradingsymbol: row.symbol,
          companyName: row.name,
          series: row.series,
        }))
      )
      .onConflictDoNothing()
  } else if (rows.length > 0) {
    const have = new Set(rows.map(row => row.tradingsymbol))
    const missing = bundled.filter(row => row.symbol.includes("&") && !have.has(row.symbol))
    if (missing.length) {
      await db
        .insert(momentumUniverse)
        .values(
          missing.map(row => ({
            tradingsymbol: row.symbol,
            companyName: row.name,
            series: row.series,
          }))
        )
        .onConflictDoNothing()
    }
  }
  const stored = await db.select().from(momentumUniverse)
  return stored
    .map(row => ({
      symbol: row.tradingsymbol,
      name: row.companyName || row.tradingsymbol,
      series: row.series,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export async function replaceUniverse(
  rows: { symbol: string; name?: string; series?: string }[]
): Promise<number> {
  await db.delete(momentumUniverse)
  if (!rows.length) return 0
  await db.insert(momentumUniverse).values(
    rows.map(row => ({
      tradingsymbol: row.symbol.toUpperCase(),
      companyName: row.name ?? row.symbol,
      series: row.series ?? "EQ",
    }))
  )
  return rows.length
}

export async function listLocks(): Promise<WeightLock[]> {
  const rows = await db.select().from(momentumWeightLocks)
  return rows.map(row => ({
    symbol: row.tradingsymbol,
    mode: row.mode === "EXCLUDE" ? "EXCLUDE" : "HOLD_WEIGHT",
    weightPct: Number(row.weightPct ?? 0),
  }))
}

export async function saveLock(lock: WeightLock | { symbol: string; clear: true }): Promise<void> {
  if ("clear" in lock) {
    await db.delete(momentumWeightLocks).where(eq(momentumWeightLocks.tradingsymbol, lock.symbol))
    return
  }
  await db
    .insert(momentumWeightLocks)
    .values({
      tradingsymbol: lock.symbol,
      mode: lock.mode,
      weightPct: String(lock.weightPct),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: momentumWeightLocks.tradingsymbol,
      set: { mode: lock.mode, weightPct: String(lock.weightPct), updatedAt: new Date() },
    })
}

export async function holdingsFor(
  strategy: "MOMENTUM" | "DAILY_TREND"
): Promise<{ symbol: string; quantity: number }[]> {
  const settings = await getRiskSettings()
  const paper = isMockOrder() || isPaperStrategy(settings, strategy)
  const rows = await db.select().from(positions).where(eq(positions.strategy, strategy))
  const qty = new Map<string, number>()
  for (const row of rows) {
    if (!provenanceInBook(row.provenance, paper ? "PAPER" : "LIVE")) continue
    qty.set(row.tradingsymbol, (qty.get(row.tradingsymbol) ?? 0) + Number(row.quantity))
  }
  return [...qty.entries()]
    .filter(([, quantity]) => quantity !== 0)
    .map(([symbol, quantity]) => ({ symbol, quantity }))
}

export async function listLatestCloses(
  symbols: string[]
): Promise<Map<string, { close: number; date: string }>> {
  const out = new Map<string, { close: number; date: string }>()
  if (!symbols.length) return out
  const result = await db.execute(sql`
    select distinct on (tradingsymbol)
      tradingsymbol,
      close::float8 as close,
      session_date::text as session_date
    from equity_daily_bars
    where tradingsymbol in (${sql.join(
      symbols.map(symbol => sql`${symbol}`),
      sql`, `
    )})
    order by tradingsymbol, session_date desc
  `)
  const raw = result as { rows?: Record<string, unknown>[] } | Record<string, unknown>[]
  const rows = Array.isArray(raw) ? raw : (raw.rows ?? [])
  for (const row of rows) {
    out.set(String(row.tradingsymbol), {
      close: Number(row.close),
      date: String(row.session_date).slice(0, 10),
    })
  }
  return out
}

export async function loadBars(symbols: string[]): Promise<Map<string, DailyBar[]>> {
  const out = new Map<string, DailyBar[]>()
  if (!symbols.length) return out
  const rows = await db
    .select()
    .from(equityDailyBars)
    .where(inArray(equityDailyBars.tradingsymbol, symbols))
  for (const row of rows) {
    const list = out.get(row.tradingsymbol) ?? []
    list.push({
      date: asDate(row.sessionDate) || "",
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
    })
    out.set(row.tradingsymbol, list)
  }
  return out
}

export async function upsertBars(symbol: string, bars: DailyBar[]): Promise<void> {
  if (!bars.length) return
  const chunk = 400
  for (let i = 0; i < bars.length; i += chunk) {
    const slice = bars.slice(i, i + chunk)
    await db
      .insert(equityDailyBars)
      .values(
        slice.map(bar => ({
          tradingsymbol: symbol,
          sessionDate: bar.date,
          open: String(bar.open),
          high: String(bar.high),
          low: String(bar.low),
          close: String(bar.close),
          volume: String(bar.volume),
        }))
      )
      .onConflictDoUpdate({
        target: [equityDailyBars.tradingsymbol, equityDailyBars.sessionDate],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
        },
      })
  }
}

export async function getDailyTrendState(): Promise<DailyTrendState> {
  const [row] = await db
    .select()
    .from(dailyTrendSettings)
    .where(eq(dailyTrendSettings.id, 1))
    .limit(1)
  if (!row) {
    await db.insert(dailyTrendSettings).values({ id: 1, config: DEFAULT_DAILY_TREND_RUNTIME })
    return { config: DEFAULT_DAILY_TREND_RUNTIME, lastDataPullOn: null }
  }
  return {
    config: normalizeDailyTrendRuntime(row.config),
    lastDataPullOn: asDate(row.lastDataPullOn),
  }
}

export async function saveDailyTrendRuntime(config: DailyTrendRuntime): Promise<DailyTrendState> {
  const next = normalizeDailyTrendRuntime(config)
  await db
    .insert(dailyTrendSettings)
    .values({ id: 1, config: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: dailyTrendSettings.id,
      set: { config: next, updatedAt: new Date() },
    })
  return getDailyTrendState()
}

export async function markDailyTrendPull(day: string): Promise<void> {
  await db
    .update(dailyTrendSettings)
    .set({ lastDataPullOn: day, updatedAt: new Date() })
    .where(eq(dailyTrendSettings.id, 1))
}

export type DailyTrendBookRow = {
  symbol: string
  enabled: boolean
  paused: boolean
  emaPeriod: number
  bufferPercent: number
  exitBufferPercent: number
  quantity: number
  entryStyle: "CLOSE_CROSS" | "BREAK_HIGH"
  status: "FLAT" | "PENDING_LONG" | "LONG"
  stop: number | null
  entry: number | null
  budgetInr: number
}

function bookFromRow(row: typeof dailyTrendBooks.$inferSelect): DailyTrendBookRow {
  return {
    symbol: row.tradingsymbol,
    enabled: row.enabled,
    paused: row.paused,
    emaPeriod: row.emaPeriod,
    bufferPercent: Number(row.bufferPercent),
    exitBufferPercent: Number(row.exitBufferPercent),
    quantity: row.quantity,
    entryStyle: row.entryStyle === "BREAK_HIGH" ? "BREAK_HIGH" : "CLOSE_CROSS",
    status: row.status === "PENDING_LONG" || row.status === "LONG" ? row.status : "FLAT",
    stop: row.stopPrice == null ? null : Number(row.stopPrice),
    entry: row.entryPrice == null ? null : Number(row.entryPrice),
    budgetInr: Number(row.budgetInr ?? 0),
  }
}

export async function listDailyTrendBooks(): Promise<DailyTrendBookRow[]> {
  const rows = await db.select().from(dailyTrendBooks)
  return rows.map(bookFromRow).sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export async function ensureNifty100Books(): Promise<void> {
  await getDailyTrendState()
  const [settings] = await db
    .select({ seeded: dailyTrendSettings.nifty100Seeded })
    .from(dailyTrendSettings)
    .where(eq(dailyTrendSettings.id, 1))
    .limit(1)
  if (settings?.seeded) return
  const names = loadNifty100()
  if (names.length) {
    await db
      .insert(dailyTrendBooks)
      .values(
        names.map(row => ({
          tradingsymbol: row.symbol,
          enabled: false,
          paused: false,
          emaPeriod: 40,
          bufferPercent: "1",
          exitBufferPercent: "1",
          quantity: 1,
          budgetInr: "0",
          entryStyle: "CLOSE_CROSS",
          status: "FLAT",
        }))
      )
      .onConflictDoNothing()
  }
  await db
    .update(dailyTrendSettings)
    .set({ nifty100Seeded: true, updatedAt: new Date() })
    .where(eq(dailyTrendSettings.id, 1))
}

export async function saveDailyTrendBook(book: DailyTrendBookRow): Promise<void> {
  const symbol = book.symbol.trim().toUpperCase()
  await db
    .insert(dailyTrendBooks)
    .values({
      tradingsymbol: symbol,
      enabled: book.enabled,
      paused: book.paused,
      emaPeriod: book.emaPeriod,
      bufferPercent: String(book.bufferPercent),
      exitBufferPercent: String(book.exitBufferPercent),
      quantity: book.quantity,
      budgetInr: String(book.budgetInr || 0),
      entryStyle: book.entryStyle,
      status: book.status,
      stopPrice: book.stop == null ? null : String(book.stop),
      entryPrice: book.entry == null ? null : String(book.entry),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dailyTrendBooks.tradingsymbol,
      set: {
        enabled: book.enabled,
        paused: book.paused,
        emaPeriod: book.emaPeriod,
        bufferPercent: String(book.bufferPercent),
        exitBufferPercent: String(book.exitBufferPercent),
        quantity: book.quantity,
        budgetInr: String(book.budgetInr || 0),
        entryStyle: book.entryStyle,
        status: book.status,
        stopPrice: book.stop == null ? null : String(book.stop),
        entryPrice: book.entry == null ? null : String(book.entry),
        updatedAt: new Date(),
      },
    })
}

export async function applyDailyTrendBulkToBooks(patch: DailyTrendBulkPatch): Promise<number> {
  const books = await listDailyTrendBooks()
  for (const book of books) {
    await saveDailyTrendBook({ ...book, ...patch })
  }
  return books.length
}

export async function removeDailyTrendBook(symbol: string): Promise<void> {
  await db.delete(dailyTrendBooks).where(eq(dailyTrendBooks.tradingsymbol, symbol.toUpperCase()))
}

export type MarketCapRow = {
  symbol: string
  name: string
  industry: string
  marketCapCr: number | null
  asOf: string | null
}

export async function listMarketCaps(): Promise<MarketCapRow[]> {
  const rows = await db.select().from(equityMarketCaps)
  return rows.map(row => ({
    symbol: row.tradingsymbol,
    name: row.companyName || row.tradingsymbol,
    industry: row.industry || "",
    marketCapCr: row.marketCapCr == null ? null : Number(row.marketCapCr),
    asOf: row.asOf,
  }))
}

export async function seedMarketCapsFromList(
  rows: { symbol: string; name: string; industry: string; marketCapCr: number | null }[],
  asOf: string
): Promise<void> {
  const missing = rows.filter(row => row.symbol)
  if (!missing.length) return
  await db
    .insert(equityMarketCaps)
    .values(
      missing.map(row => ({
        tradingsymbol: row.symbol,
        companyName: row.name,
        industry: row.industry,
        marketCapCr: row.marketCapCr == null ? null : String(row.marketCapCr),
        asOf: row.marketCapCr == null ? null : asOf,
      }))
    )
    .onConflictDoNothing()
}

export async function marketCapsDue(today: string, limit: number): Promise<string[]> {
  const rows = await db
    .select({ symbol: equityMarketCaps.tradingsymbol, asOf: equityMarketCaps.asOf })
    .from(equityMarketCaps)
    .orderBy(asc(equityMarketCaps.asOf))
  return rows
    .filter(row => row.asOf == null || row.asOf < today)
    .slice(0, limit)
    .map(row => row.symbol)
}

export async function saveMarketCap(row: {
  symbol: string
  marketCapCr: number
  asOf: string
}): Promise<void> {
  await db
    .insert(equityMarketCaps)
    .values({
      tradingsymbol: row.symbol,
      marketCapCr: String(row.marketCapCr),
      asOf: row.asOf,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: equityMarketCaps.tradingsymbol,
      set: {
        marketCapCr: String(row.marketCapCr),
        asOf: row.asOf,
        updatedAt: new Date(),
      },
    })
}
