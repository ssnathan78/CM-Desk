import logger from "../logger"
import { isSessionOpen } from "../marketCalendar"
import { firstTradingSessionOfMonth, isoWeekdayIst, istDate, previousIstDate } from "./calendar"
import { buildMomentumPlan, executableOrders } from "./engine"
import { submitCashOrders } from "./execute"
import { pullCashHistory } from "./history"
import { rankedSymbols } from "./rankStored"
import {
  claimMomentumRebalance,
  ensureNifty100Books,
  getMomentumState,
  holdingsFor,
  listLocks,
  listUniverse,
} from "./store"
import { ordersAllowed, rebalanceDue } from "./types"

function cashSchedulerStarted(): boolean {
  const g = globalThis as typeof globalThis & { __cmDeskCashScheduler?: boolean }
  return Boolean(g.__cmDeskCashScheduler)
}

function markCashSchedulerStarted() {
  const g = globalThis as typeof globalThis & { __cmDeskCashScheduler?: boolean }
  g.__cmDeskCashScheduler = true
}

export async function runCashSchedulerOnce(accessToken?: string | null) {
  const history = await pullCashHistory({ accessToken, force: false })
  const state = await getMomentumState()
  const today = istDate(new Date())
  const due = rebalanceDue(state.config, {
    isoWeekday: isoWeekdayIst(new Date()),
    firstSessionOfMonth: firstTradingSessionOfMonth(new Date()),
  })
  const sessionOpen = isSessionOpen(Date.now())
  if (
    state.config.active &&
    state.lastRebalanceOn !== today &&
    sessionOpen &&
    ordersAllowed({ execution: state.config.execution, executeRequested: false, due })
  ) {
    const claimed = await claimMomentumRebalance(today)
    if (claimed) {
      try {
        const universe = await listUniverse()
        const asOf = previousIstDate(new Date())
        const plan = buildMomentumPlan({
          symbols: await rankedSymbols(universe, state.config, asOf),
          config: state.config,
          holdings: await holdingsFor("MOMENTUM"),
          locks: await listLocks(),
          asOf,
        })
        const orders = executableOrders(plan, {
          execution: state.config.execution,
          executeRequested: false,
          due,
        })
        const results = orders.length
          ? await submitCashOrders({ accessToken, strategy: "MOMENTUM", orders })
          : []
        const failed = results.filter(row => !row.ok)
        if (failed.length) {
          const { recordOperatorAlert } = await import("../trading/alerts")
          await recordOperatorAlert({
            source: "STRATEGY",
            code: "MOMENTUM_REBALANCE_FAILED",
            severity: "ERROR",
            summary: `Momentum rebalance claimed ${today} with ${failed.length} rejected order(s). This day will not be retried.`,
            strategy: "MOMENTUM",
            idempotencyKey: `alert:momentum-rebalance:${today}`,
          })
        }
      } catch (error) {
        logger.error("[cashScheduler] momentum rebalance failed after claim", error)
        const { recordOperatorAlert } = await import("../trading/alerts")
        await recordOperatorAlert({
          source: "STRATEGY",
          code: "MOMENTUM_REBALANCE_FAILED",
          severity: "ERROR",
          summary: `Momentum rebalance claimed ${today} and then failed. This day will not be retried.`,
          strategy: "MOMENTUM",
          idempotencyKey: `alert:momentum-rebalance:${today}`,
        })
      }
    }
  }
  const { evaluateDailyTrend } = await import("./trendRun")
  await evaluateDailyTrend({ execute: false, accessToken })
  await ensureNifty100Books()
  const { refreshStaleMarketCaps, seedKnownMarketCaps } = await import("../dailyTrend/marketCap")
  await seedKnownMarketCaps()
  await refreshStaleMarketCaps(20).catch(error => logger.error("[marketCap]", error))
  const { refreshStaleMembership } = await import("./membershipRefresh")
  await refreshStaleMembership().catch(error => logger.error("[membership]", error))
  if (state.config.active) {
    const { getMomentumReport } = await import("./storedReport")
    await getMomentumReport({ fresh: true }).catch(error => logger.error("[momentumReport]", error))
  }
  return history
}

export function startCashScheduler() {
  if (cashSchedulerStarted()) return
  if (
    process.env.JEST_WORKER_ID ||
    process.env.SIMULATION === "true" ||
    process.env.NODE_ENV === "test"
  ) {
    return
  }
  markCashSchedulerStarted()
  const tick = () => {
    void runCashSchedulerOnce()
      .then(async () => {
        const { restoreChaseSchedulers } = await import("../queue")
        await restoreChaseSchedulers()
      })
      .catch(error => logger.error("[cashScheduler]", error))
  }
  setTimeout(tick, 20_000)
  setInterval(tick, 60 * 60 * 1000)
}
