import logger from "../logger"
import { isSessionOpen } from "../marketCalendar"
import { firstTradingSessionOfMonth, isoWeekdayIst, istDate, previousIstDate } from "./calendar"
import { buildMomentumPlan, executableOrders } from "./engine"
import { submitCashOrders } from "./execute"
import { pullCashHistory } from "./history"
import { rankedSymbols } from "./rankStored"
import {
  ensureNifty100Books,
  getMomentumState,
  holdingsFor,
  listLocks,
  listUniverse,
  markMomentumRebalance,
} from "./store"
import { ordersAllowed, rebalanceDue } from "./types"

let started = false

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
    if (orders.length) {
      await submitCashOrders({ accessToken, strategy: "MOMENTUM", orders })
    }
    await markMomentumRebalance(today)
  }
  const { evaluateDailyTrend } = await import("./trendRun")
  await evaluateDailyTrend({ execute: false, accessToken })
  await ensureNifty100Books()
  const { refreshStaleMarketCaps, seedKnownMarketCaps } = await import("../dailyTrend/marketCap")
  await seedKnownMarketCaps()
  await refreshStaleMarketCaps(20).catch(error => logger.error("[marketCap]", error))
  return history
}

export function startCashScheduler() {
  if (started) return
  if (
    process.env.JEST_WORKER_ID ||
    process.env.SIMULATION === "true" ||
    process.env.NODE_ENV === "test"
  ) {
    return
  }
  started = true
  const tick = () => {
    void runCashSchedulerOnce().catch(error => logger.error("[cashScheduler]", error))
  }
  setTimeout(tick, 20_000)
  setInterval(tick, 60 * 60 * 1000)
}
