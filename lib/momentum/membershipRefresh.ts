import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "../drizzle"
import { indexMembership, indexMembershipChanges } from "../schema"
import { istDate } from "./calendar"
import {
  type Constituent,
  constituentRemovalNote,
  type IndexCode,
  membershipFileApplies,
  membershipStale,
  parseConstituentCsv,
  planMembershipDiff,
  symbolsMissingFromSnapshot,
} from "./membership"
import {
  addUniverseRows,
  holdingsFor,
  insertDailyTrendBooksOff,
  listDailyTrendBooks,
  listLocks,
  listUniverse,
  removeDailyTrendBook,
  removeUniverseSymbol,
  removeUniverseSymbols,
} from "./store"

const SOURCES: Record<IndexCode, { url: string; file: string }> = {
  NIFTY100: {
    url: "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv",
    file: "data/universe/nifty-100.csv",
  },
  NIFTY_TOTAL_MARKET: {
    url: "https://www.niftyindices.com/IndexConstituent/ind_niftytotalmarket_list.csv",
    file: "data/universe/nifty-total-market.csv",
  },
}

export type PendingConstituent = {
  id: number
  indexCode: string
  symbol: string
  name: string | null
  action: "ADD" | "REMOVE"
  note: string
}

async function bundledOrRemote(
  indexCode: IndexCode
): Promise<{ text: string; source: "remote" | "bundled" } | null> {
  const source = SOURCES[indexCode]
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "CM-Desk", Accept: "text/csv" },
      signal: AbortSignal.timeout(15_000),
    })
    if (response.ok) {
      const text = await response.text()
      if (parseConstituentCsv(text).length) return { text, source: "remote" }
    }
  } catch {
    // The bundled file is the bootstrap when the download fails.
  }
  try {
    return { text: readFileSync(resolve(process.cwd(), source.file), "utf8"), source: "bundled" }
  } catch {
    return null
  }
}

async function latestAsOf(indexCode: IndexCode): Promise<string | null> {
  const [row] = await db
    .select({ asOf: indexMembership.asOf })
    .from(indexMembership)
    .where(eq(indexMembership.indexCode, indexCode))
    .orderBy(desc(indexMembership.asOf))
    .limit(1)
  if (!row?.asOf) return null
  return String(row.asOf).slice(0, 10)
}

async function snapshotSymbols(indexCode: IndexCode): Promise<string[]> {
  const rows = await db
    .select({ tradingsymbol: indexMembership.tradingsymbol })
    .from(indexMembership)
    .where(eq(indexMembership.indexCode, indexCode))
  return rows.map(row => row.tradingsymbol)
}

export async function listPendingConstituents(indexCode: IndexCode): Promise<PendingConstituent[]> {
  const rows = await db
    .select()
    .from(indexMembershipChanges)
    .where(
      and(
        eq(indexMembershipChanges.indexCode, indexCode),
        eq(indexMembershipChanges.status, "PENDING")
      )
    )
  return rows
    .map(row => ({
      id: row.id,
      indexCode: row.indexCode,
      symbol: row.tradingsymbol,
      name: row.companyName,
      action: (row.action === "REMOVE" ? "REMOVE" : "ADD") as "ADD" | "REMOVE",
      note: row.note,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

async function rememberPending(
  pending: ReturnType<typeof planMembershipDiff>["pending"],
  today: string
): Promise<void> {
  if (!pending.length) return
  const open = await db
    .select({
      action: indexMembershipChanges.action,
      tradingsymbol: indexMembershipChanges.tradingsymbol,
      indexCode: indexMembershipChanges.indexCode,
    })
    .from(indexMembershipChanges)
    .where(eq(indexMembershipChanges.status, "PENDING"))
  const seen = new Set(open.map(row => `${row.indexCode}|${row.action}|${row.tradingsymbol}`))
  const fresh = pending.filter(row => !seen.has(`${row.indexCode}|${row.action}|${row.symbol}`))
  if (!fresh.length) return
  await db.insert(indexMembershipChanges).values(
    fresh.map(row => ({
      indexCode: row.indexCode,
      tradingsymbol: row.symbol,
      companyName: row.name,
      action: row.action,
      note: row.note,
      status: "PENDING",
      detectedOn: today,
      updatedAt: new Date(),
    }))
  )
}

export async function refreshIndexMembership(
  indexCode: IndexCode,
  options?: { force?: boolean; loadText?: () => Promise<string | null> }
): Promise<{ applied: boolean; pending: number; autoAdded: number; kept: boolean }> {
  const today = istDate(new Date())
  if (!options?.force && !membershipStale(await latestAsOf(indexCode), today)) {
    return { applied: false, pending: 0, autoAdded: 0, kept: false }
  }
  const loaded = options?.loadText
    ? { text: await options.loadText(), source: "remote" as const }
    : await bundledOrRemote(indexCode)
  const text = loaded?.text ?? null
  const incoming: Constituent[] = text ? parseConstituentCsv(text) : []
  const [universe, books, locks, momentumHeld, trendHeld, previous] = await Promise.all([
    listUniverse(),
    listDailyTrendBooks(),
    listLocks(),
    holdingsFor("MOMENTUM"),
    holdingsFor("DAILY_TREND"),
    snapshotSymbols(indexCode),
  ])
  const plan = planMembershipDiff({
    indexCode,
    incoming,
    previous,
    universe: universe.map(row => row.symbol),
    books: books.map(row => row.symbol),
    locks: locks.map(row => row.symbol),
    openSymbols: [...new Set([...momentumHeld, ...trendHeld].map(row => row.symbol))],
  })
  if (!plan.apply) return { applied: false, pending: 0, autoAdded: 0, kept: false }
  if (!membershipFileApplies(loaded?.source ?? "bundled", previous.length)) {
    const { recordOperatorAlert } = await import("../trading/alerts")
    await recordOperatorAlert({
      code: "INDEX_FILE",
      severity: "WARN",
      source: "STRATEGY",
      eventType: "BROKER_ERROR",
      summary:
        indexCode === "NIFTY100"
          ? "The Nifty 100 file could not be downloaded. The stored list was left as it is."
          : "The Nifty Total Market file could not be downloaded. The rank list was left as it is.",
      strategy: indexCode === "NIFTY100" ? "DAILY_TREND" : "MOMENTUM",
      idempotencyKey: `index-file:${indexCode}:${today}`,
    })
    return { applied: false, pending: 0, autoAdded: 0, kept: true }
  }
  const autoAdded = await insertDailyTrendBooksOff(plan.autoAddBooks)
  await db.delete(indexMembership).where(eq(indexMembership.indexCode, indexCode))
  await db.insert(indexMembership).values(
    incoming.map(row => ({
      indexCode,
      tradingsymbol: row.symbol,
      companyName: row.name,
      series: row.series,
      asOf: today,
    }))
  )
  await rememberPending(plan.pending, today)
  if (indexCode === "NIFTY_TOTAL_MARKET") await queueUniverseMissingFromFile()
  return { applied: true, pending: plan.pending.length, autoAdded, kept: false }
}

/** Rank-list names absent from the stored Total Market file, queued once. */
export async function queueUniverseMissingFromFile(): Promise<number> {
  const snapshot = await snapshotSymbols("NIFTY_TOTAL_MARKET")
  const [universe, books, locks, momentumHeld, trendHeld, tracked] = await Promise.all([
    listUniverse(),
    listDailyTrendBooks(),
    listLocks(),
    holdingsFor("MOMENTUM"),
    holdingsFor("DAILY_TREND"),
    db
      .select({ tradingsymbol: indexMembershipChanges.tradingsymbol })
      .from(indexMembershipChanges)
      .where(
        and(
          eq(indexMembershipChanges.indexCode, "NIFTY_TOTAL_MARKET"),
          eq(indexMembershipChanges.action, "REMOVE")
        )
      ),
  ])
  const missing = symbolsMissingFromSnapshot(
    universe.map(row => row.symbol),
    snapshot,
    tracked.map(row => row.tradingsymbol)
  )
  if (!missing.length) return 0
  const flags = {
    universe: new Set(universe.map(row => row.symbol)),
    books: new Set(books.map(row => row.symbol)),
    locks: new Set(locks.map(row => row.symbol)),
    openSymbols: new Set([...momentumHeld, ...trendHeld].map(row => row.symbol)),
  }
  const names = new Map(universe.map(row => [row.symbol, row.name]))
  await rememberPending(
    missing.map(symbol => ({
      indexCode: "NIFTY_TOTAL_MARKET" as const,
      symbol,
      name: names.get(symbol) || symbol,
      action: "REMOVE" as const,
      note: constituentRemovalNote("NIFTY_TOTAL_MARKET", symbol, flags),
    })),
    istDate(new Date())
  )
  return missing.length
}

export async function listMomentumConstituents(): Promise<PendingConstituent[]> {
  await queueUniverseMissingFromFile()
  return listPendingConstituents("NIFTY_TOTAL_MARKET")
}

export async function settlePendingConstituents(
  indexCode: IndexCode,
  side: "ADD" | "REMOVE",
  decision: "ACCEPTED" | "DISMISSED"
): Promise<number> {
  const rows = await db
    .select()
    .from(indexMembershipChanges)
    .where(
      and(
        eq(indexMembershipChanges.indexCode, indexCode),
        eq(indexMembershipChanges.action, side),
        eq(indexMembershipChanges.status, "PENDING")
      )
    )
  if (!rows.length) return 0
  if (decision === "ACCEPTED") {
    if (side === "ADD" && indexCode === "NIFTY_TOTAL_MARKET") {
      await addUniverseRows(
        rows.map(row => ({
          symbol: row.tradingsymbol,
          name: row.companyName ?? row.tradingsymbol,
        }))
      )
    }
    if (side === "ADD" && indexCode === "NIFTY100") {
      await insertDailyTrendBooksOff(rows.map(row => ({ symbol: row.tradingsymbol })))
    }
    if (side === "REMOVE" && indexCode === "NIFTY_TOTAL_MARKET") {
      await removeUniverseSymbols(rows.map(row => row.tradingsymbol))
    }
    if (side === "REMOVE" && indexCode === "NIFTY100") {
      for (const row of rows) await removeDailyTrendBook(row.tradingsymbol)
    }
  }
  await db
    .update(indexMembershipChanges)
    .set({ status: decision, updatedAt: new Date() })
    .where(
      inArray(
        indexMembershipChanges.id,
        rows.map(row => row.id)
      )
    )
  return rows.length
}

export async function refreshStaleMembership(): Promise<void> {
  await refreshIndexMembership("NIFTY100")
  await refreshIndexMembership("NIFTY_TOTAL_MARKET")
}

export async function acceptConstituentChange(id: number): Promise<void> {
  const [row] = await db
    .select()
    .from(indexMembershipChanges)
    .where(eq(indexMembershipChanges.id, id))
    .limit(1)
  if (row?.status !== "PENDING") return
  if (row.action === "ADD" && row.indexCode === "NIFTY_TOTAL_MARKET") {
    await addUniverseRows([
      { symbol: row.tradingsymbol, name: row.companyName ?? row.tradingsymbol },
    ])
  }
  if (row.action === "ADD" && row.indexCode === "NIFTY100") {
    await insertDailyTrendBooksOff([{ symbol: row.tradingsymbol }])
  }
  if (row.action === "REMOVE" && row.indexCode === "NIFTY_TOTAL_MARKET") {
    await removeUniverseSymbol(row.tradingsymbol)
  }
  if (row.action === "REMOVE" && row.indexCode === "NIFTY100") {
    await removeDailyTrendBook(row.tradingsymbol)
  }
  await db
    .update(indexMembershipChanges)
    .set({ status: "ACCEPTED", updatedAt: new Date() })
    .where(eq(indexMembershipChanges.id, id))
}

export async function dismissConstituentChange(id: number): Promise<void> {
  await db
    .update(indexMembershipChanges)
    .set({ status: "DISMISSED", updatedAt: new Date() })
    .where(and(eq(indexMembershipChanges.id, id), eq(indexMembershipChanges.status, "PENDING")))
}
