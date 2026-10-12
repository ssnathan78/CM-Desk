import { eq } from "drizzle-orm"

import {
  aggregateChaseConfig,
  CHASE_INDEX_ORDER,
  CHASE_MASTER_DEFAULTS,
  type ChaseBookConfig,
  type ChaseEngineConfig,
  defaultChaseBook,
  normalizeChaseMarketProtection,
} from "./chaseDefaults"
import { normalizeChaseOpenClassify } from "./chaseOpenClassify"
import { chaseRemoveBlockReason, normalizeChaseUnderlying } from "./chaseUniverse"
import {
  chaseIndexFromSymbol,
  normalizeChaseInstruments,
  validateChaseSettings,
} from "./chaseValidation"
import { db } from "./drizzle"
import { chaseSettings, chaseUniverse } from "./schema"

export { CHASE_MASTER_DEFAULTS } from "./chaseDefaults"
export type { ChaseBookConfig, ChaseEngineConfig }

let cache: { at: number; books: ChaseBookConfig[] } | null = null
const CACHE_MS = 5_000

function toBook(row: {
  instrument: string
  lots: number
  emaPeriod: number
  bufferPercent: string | number
  entryLimitOffset: string | number
  marketProtectionPercent?: string | number | null
  paused: boolean
  enabled: boolean
  openClassify?: unknown
}): ChaseBookConfig {
  return {
    instrument: row.instrument,
    lots: Number(row.lots) || CHASE_MASTER_DEFAULTS.lots,
    emaPeriod: Number(row.emaPeriod) || CHASE_MASTER_DEFAULTS.emaPeriod,
    bufferPercent: Number(row.bufferPercent),
    entryLimitOffset: Number(row.entryLimitOffset),
    marketProtectionPercent: normalizeChaseMarketProtection(row.marketProtectionPercent),
    paused: Boolean(row.paused),
    enabled: Boolean(row.enabled),
    instruments: row.enabled ? [row.instrument] : [],
    openClassify: normalizeChaseOpenClassify(row.openClassify),
  }
}

function orderBooks(rows: ChaseBookConfig[]): ChaseBookConfig[] {
  const rank = new Map<string, number>(CHASE_INDEX_ORDER.map((name, index) => [name, index]))
  return [...rows].sort((a, b) => {
    const aRank = rank.get(a.instrument) ?? 100
    const bRank = rank.get(b.instrument) ?? 100
    if (aRank !== bRank) return aRank - bRank
    return a.instrument.localeCompare(b.instrument)
  })
}

function setCache(books: ChaseBookConfig[]) {
  cache = { at: Date.now(), books }
}

export async function listChaseBooks(): Promise<ChaseBookConfig[]> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) {
    return cache.books
  }
  const rows = await db.select().from(chaseSettings)
  const books = orderBooks(rows.map(toBook))
  setCache(books)
  return books
}

export async function listEnabledChaseBooks(): Promise<ChaseBookConfig[]> {
  return (await listChaseBooks()).filter(book => book.enabled)
}

export async function getChaseBook(instrument: string): Promise<ChaseBookConfig> {
  const index = String(instrument || "NIFTY").toUpperCase()
  const books = await listChaseBooks()
  return books.find(book => book.instrument === index) ?? defaultChaseBook(index, false)
}

export async function chaseMarketProtectionForSymbol(tradingsymbol: string): Promise<number> {
  const underlying = chaseIndexFromSymbol(tradingsymbol)
  if (!underlying) return CHASE_MASTER_DEFAULTS.marketProtectionPercent
  const book = (await listChaseBooks()).find(row => row.instrument === underlying)
  return book?.marketProtectionPercent ?? CHASE_MASTER_DEFAULTS.marketProtectionPercent
}

export async function getChaseSettings(): Promise<ChaseEngineConfig> {
  return aggregateChaseConfig(await listChaseBooks())
}

async function upsertBook(next: ChaseBookConfig): Promise<void> {
  await db
    .insert(chaseSettings)
    .values({
      instrument: next.instrument,
      lots: next.lots,
      emaPeriod: next.emaPeriod,
      bufferPercent: String(next.bufferPercent),
      entryLimitOffset: String(next.entryLimitOffset),
      marketProtectionPercent: String(next.marketProtectionPercent),
      paused: next.paused,
      enabled: next.enabled,
      openClassify: next.openClassify,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: chaseSettings.instrument,
      set: {
        lots: next.lots,
        emaPeriod: next.emaPeriod,
        bufferPercent: String(next.bufferPercent),
        entryLimitOffset: String(next.entryLimitOffset),
        marketProtectionPercent: String(next.marketProtectionPercent),
        paused: next.paused,
        enabled: next.enabled,
        openClassify: next.openClassify,
        updatedAt: new Date(),
      },
    })
}

function mergeBook(current: ChaseBookConfig, patch: Partial<ChaseBookConfig>): ChaseBookConfig {
  return {
    instrument: current.instrument,
    lots: Math.max(1, Number(patch.lots ?? current.lots) || 1),
    emaPeriod: Math.max(1, Math.min(500, Number(patch.emaPeriod ?? current.emaPeriod) || 40)),
    bufferPercent:
      patch.bufferPercent == null
        ? current.bufferPercent
        : Math.min(10, Math.max(0, Number(patch.bufferPercent))),
    entryLimitOffset:
      patch.entryLimitOffset == null
        ? current.entryLimitOffset
        : Math.min(100, Math.max(0, Number(patch.entryLimitOffset))),
    marketProtectionPercent: normalizeChaseMarketProtection(
      patch.marketProtectionPercent ?? current.marketProtectionPercent
    ),
    paused: patch.paused == null ? current.paused : Boolean(patch.paused),
    enabled: patch.enabled == null ? current.enabled : Boolean(patch.enabled),
    instruments: [current.instrument],
    openClassify: normalizeChaseOpenClassify(patch.openClassify ?? current.openClassify),
  }
}

export async function saveChaseBook(
  instrument: string,
  patch: Partial<ChaseBookConfig>
): Promise<ChaseBookConfig> {
  const validation = validateChaseSettings(patch)
  if (!validation.ok) {
    throw new Error(validation.error)
  }
  const current = await getChaseBook(instrument)
  const next = mergeBook(current, patch)
  await upsertBook(next)
  cache = null
  if (current.paused !== next.paused) {
    const { recordAuditEvent } = await import("./trading/ledger")
    await recordAuditEvent({
      eventType: next.paused ? "STRATEGY_PAUSED" : "STRATEGY_RESUMED",
      actor: "USER",
      summary: next.paused
        ? `Chase paused (${next.instrument})`
        : `Chase resumed (${next.instrument})`,
      idempotencyKey: `chase-pause:${next.instrument}:${next.paused}:${Date.now()}`,
    })
  }
  return next
}

export async function saveChaseSettings(
  patch: Partial<ChaseEngineConfig> & { instrument?: string; enabled?: boolean }
): Promise<ChaseEngineConfig> {
  const validation = validateChaseSettings(patch)
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const books = await listChaseBooks()
  if (patch.instrument) {
    const name = normalizeChaseUnderlying(patch.instrument)
    if (!name || !books.some(book => book.instrument === name)) {
      throw new Error("Add this underlying on the Chase page before saving it")
    }
    await saveChaseBook(name, patch)
    return getChaseSettings()
  }

  if (patch.instruments) {
    const enabled = new Set(normalizeChaseInstruments(patch.instruments))
    const known = new Set(books.map(book => book.instrument))
    const missing = [...enabled].filter(name => !known.has(name))
    if (missing.length) {
      throw new Error(`Add ${missing.join(", ")} on the Chase page before turning it on`)
    }
    for (const book of books) {
      const turningOn = enabled.has(book.instrument)
      await saveChaseBook(book.instrument, {
        ...patch,
        enabled: turningOn,
        paused: turningOn ? (patch.paused ?? (book.enabled ? book.paused : false)) : true,
      })
    }
    return getChaseSettings()
  }

  for (const book of books.filter(row => row.enabled)) {
    await saveChaseBook(book.instrument, patch)
  }
  return getChaseSettings()
}

export async function resetChaseBooks(): Promise<ChaseEngineConfig> {
  for (const book of await listChaseBooks()) {
    await saveChaseBook(book.instrument, {
      ...CHASE_MASTER_DEFAULTS,
      enabled: book.instrument === "NIFTY",
      paused: book.instrument !== "NIFTY",
    })
  }
  return getChaseSettings()
}

export async function addChaseUnderlying(instrument: string): Promise<ChaseBookConfig> {
  const name = normalizeChaseUnderlying(instrument)
  if (!name) throw new Error("Chase underlying names must be Kite NFO symbols")
  const existing = (await listChaseBooks()).find(book => book.instrument === name)
  if (existing) return existing
  await db.insert(chaseUniverse).values({ instrument: name, exchange: "NFO" }).onConflictDoNothing()
  const book = defaultChaseBook(name, false)
  await upsertBook(book)
  cache = null
  return book
}

export async function removeChaseUnderlying(
  instrument: string,
  status: string | null,
  netQty: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = normalizeChaseUnderlying(instrument)
  if (!name) return { ok: false, error: "Chase underlying names must be Kite NFO symbols" }
  const blocked = chaseRemoveBlockReason(status, netQty)
  if (blocked) return { ok: false, error: blocked }
  const existing = (await listChaseBooks()).find(book => book.instrument === name)
  if (!existing) return { ok: false, error: `${name} is not a Chase book` }
  await db.delete(chaseSettings).where(eq(chaseSettings.instrument, name))
  await db.delete(chaseUniverse).where(eq(chaseUniverse.instrument, name))
  cache = null
  return { ok: true }
}

export async function pauseAllChaseBooks(): Promise<void> {
  for (const book of await listChaseBooks()) {
    await saveChaseBook(book.instrument, { paused: true })
  }
}

export async function getChaseEngineConfig(): Promise<ChaseEngineConfig> {
  return getChaseSettings()
}
