import type { KiteUser } from "../types/misc"
import { CHASE_STATUS } from "./constants"
import { updateChaseStatus } from "./drizzleDbUtils"
import { LIVE_FLATTEN_MARKET_CLOSED } from "./flattenNotice"
import { flattenOpenPositions } from "./flattenOpen"
import { abortTodaysJobExecutions } from "./jobControl"
import logger from "./logger"

export type KillDeskScope = "intraday" | "all"

/** Chase books whose flatten was skipped and not covered. Those stay LONG or SHORT. */
export function chaseBooksKeptOpen(
  books: string[],
  skipped: Array<{ tradingsymbol?: string; reason: string }>,
  flattenedSymbols: string[]
): Set<string> {
  const covered = new Set(flattenedSymbols)
  const ordered = [...books].sort((a, b) => b.length - a.length)
  const kept = new Set<string>()
  for (const row of skipped) {
    const symbol = (row.tradingsymbol || "").toUpperCase()
    if (!symbol || covered.has(row.tradingsymbol || "") || row.reason === "already flat") continue
    const match = ordered.find(name => symbol.startsWith(name.toUpperCase()))
    if (match) kept.add(match)
  }
  return kept
}

export async function runDeskKill(scope: KillDeskScope, user: KiteUser) {
  let flatten = {
    flattened: [] as Array<{ tradingsymbol: string }>,
    skipped: [] as Array<{ tradingsymbol?: string; reason: string }>,
  }
  let flattenFailed = false
  try {
    const result = await flattenOpenPositions({
      user,
      scope: scope === "all" ? { kind: "all" } : { kind: "intraday" },
      abortOptionJobs: false,
    })
    flatten = result
  } catch (e) {
    flattenFailed = true
    logger.error("[runDeskKill] flatten failed", e)
  }

  const aborted = await abortTodaysJobExecutions(scope)
  const liveLeftOpen = flatten.skipped.some(row => row.reason === LIVE_FLATTEN_MARKET_CLOSED)

  let chasePaused = false
  if (scope === "all") {
    try {
      const { pauseAllChaseBooks } = await import("./chaseSettings")
      await pauseAllChaseBooks()
      chasePaused = true
    } catch (e) {
      logger.error("[runDeskKill] Chase pause failed", e)
    }
    try {
      const { listChaseBooks } = await import("./chaseSettings")
      const books = await listChaseBooks()
      const names = books.map(book => book.instrument)
      const kept = flattenFailed
        ? new Set(names)
        : chaseBooksKeptOpen(
            names,
            flatten.skipped,
            flatten.flattened.map(row => row.tradingsymbol)
          )
      for (const book of books) {
        if (kept.has(book.instrument)) continue
        await updateChaseStatus({
          instrument: book.instrument,
          status: CHASE_STATUS.AWAITING_SIGNAL,
          updatedAt: new Date(),
        })
      }
    } catch (e) {
      logger.error("[runDeskKill] Chase status reset failed", e)
    }
  }

  let deskHalted = false
  try {
    const { haltDesk } = await import("./trading/riskSettings")
    await haltDesk(
      scope === "all" ? "Kill desk (all strategies including Chase)" : "Kill desk (intraday)",
      "USER"
    )
    deskHalted = true
  } catch (e) {
    logger.error("[runDeskKill] could not persist desk halt", e)
  }

  return {
    scope,
    aborted: aborted.length,
    chasePaused,
    deskHalted,
    liveLeftOpen,
    flattenFailed,
  }
}

export { killOperatorNotice, killResponseStatus } from "./killNotice"
