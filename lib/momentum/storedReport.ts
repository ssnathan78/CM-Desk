import { firstTradingSessionOfMonth, isoWeekdayIst, previousIstDate } from "./calendar"
import type { HoldingQty, PlannedOrder, TargetLine, WeightLock } from "./engine"
import { buildMomentumPlan } from "./engine"
import { rankedSymbols } from "./rankStored"
import { momentumReportFingerprint, shouldUseStoredMomentumReport } from "./reportCache"
import {
  getMomentumState,
  holdingsFor,
  listLocks,
  listUniverse,
  readMomentumReportCache,
  saveMomentumReportCache,
} from "./store"
import type { MomentumConfig } from "./types"
import { rebalanceDue } from "./types"

export type MomentumReport = {
  active: boolean
  computedAt: string | null
  config: MomentumConfig
  lastDataPullOn: string | null
  lastRebalanceOn: string | null
  due?: boolean
  holdings?: HoldingQty[]
  locks: WeightLock[]
  targets: TargetLine[]
  orders: PlannedOrder[]
  rows: Array<Record<string, unknown>>
}

let inflight: { fingerprint: string; promise: Promise<MomentumReport> } | null = null

async function computeReport(options?: {
  deployCash?: boolean
  trimPct?: number
}): Promise<MomentumReport> {
  const state = await getMomentumState()
  const universe = await listUniverse()
  const asOf = previousIstDate(new Date())
  const locks = await listLocks()
  const holdings = state.config.active ? await holdingsFor("MOMENTUM") : []
  const fingerprint = momentumReportFingerprint({
    config: state.config,
    locks,
    holdings,
    universe: universe.map(row => row.symbol),
    asOf,
  })
  if (!state.config.active) {
    const report: MomentumReport = {
      active: false,
      config: state.config,
      lastDataPullOn: state.lastDataPullOn,
      lastRebalanceOn: state.lastRebalanceOn,
      rows: universe.map(row => ({
        symbol: row.symbol,
        name: row.name,
        rank: null,
        filterPass: false,
        filterReasons: ["strategy is off"],
        metrics: null,
        price: null,
      })),
      targets: [],
      orders: [],
      locks,
      computedAt: new Date().toISOString(),
    }
    await saveMomentumReportCache({ fingerprint, report: { ...report }, asOf })
    return report
  }
  const symbols = await rankedSymbols(universe, state.config, asOf)
  const plan = buildMomentumPlan({
    symbols,
    config: state.config,
    holdings,
    locks,
    asOf,
    deployCash: options?.deployCash,
    trimPct: options?.trimPct,
  })
  const names = new Map(universe.map(row => [row.symbol, row.name]))
  const report: MomentumReport = {
    active: true,
    config: state.config,
    lastDataPullOn: state.lastDataPullOn,
    lastRebalanceOn: state.lastRebalanceOn,
    due: rebalanceDue(state.config, {
      isoWeekday: isoWeekdayIst(new Date()),
      firstSessionOfMonth: firstTradingSessionOfMonth(new Date()),
    }),
    holdings,
    locks,
    targets: plan.targets,
    orders: plan.orders,
    rows: plan.ranked.map(row => ({ ...row, name: names.get(row.symbol) ?? row.symbol })),
    computedAt: new Date().toISOString(),
  }
  const special = Boolean(options?.deployCash || (options?.trimPct ?? 0) > 0)
  if (!special) {
    const latest = momentumReportFingerprint({
      config: (await getMomentumState()).config,
      locks: await listLocks(),
      holdings: await holdingsFor("MOMENTUM"),
      universe: (await listUniverse()).map(row => row.symbol),
      asOf: previousIstDate(new Date()),
    })
    if (latest === fingerprint) {
      await saveMomentumReportCache({ fingerprint, report: { ...report }, asOf })
    }
  }
  return report
}

/** Page loads reuse the stored rank. Preview, send, deploy, and trim pass fresh. */
export async function getMomentumReport(options?: {
  deployCash?: boolean
  trimPct?: number
  fresh?: boolean
}): Promise<MomentumReport> {
  if (!shouldUseStoredMomentumReport(options)) return computeReport(options)
  const state = await getMomentumState()
  const asOf = previousIstDate(new Date())
  const locks = await listLocks()
  const universe = await listUniverse()
  const holdings = state.config.active ? await holdingsFor("MOMENTUM") : []
  const fingerprint = momentumReportFingerprint({
    config: state.config,
    locks,
    holdings,
    universe: universe.map(row => row.symbol),
    asOf,
  })
  const cached = await readMomentumReportCache()
  if (cached && cached.fingerprint === fingerprint) {
    return { ...(cached.report as MomentumReport), computedAt: cached.computedAt }
  }
  if (inflight?.fingerprint === fingerprint) return inflight.promise
  const promise = computeReport().finally(() => {
    if (inflight?.promise === promise) inflight = null
  })
  inflight = { fingerprint, promise }
  return promise
}
