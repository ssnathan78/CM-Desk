import { sendApiError } from "../../lib/apiErrors"
import logger from "../../lib/logger"
import {
  firstTradingSessionOfMonth,
  isoWeekdayIst,
  istDate,
  previousIstDate,
} from "../../lib/momentum/calendar"
import { buildMomentumPlan, executableOrders } from "../../lib/momentum/engine"
import { submitCashOrders } from "../../lib/momentum/execute"
import { pullCashHistory } from "../../lib/momentum/history"
import { rankedSymbols } from "../../lib/momentum/rankStored"
import {
  getMomentumState,
  holdingsFor,
  listLocks,
  listUniverse,
  markMomentumRebalance,
  replaceUniverse,
  saveLock,
  saveMomentumConfig,
} from "../../lib/momentum/store"
import { normalizeMomentumConfig, rebalanceDue } from "../../lib/momentum/types"
import { normalizeNseCashSymbol } from "../../lib/nseCashSymbol"
import withSession from "../../lib/session"

let rankGeneration = 0
let reportInflight: { generation: number; promise: ReturnType<typeof computeReport> } | null = null

async function report() {
  const generation = rankGeneration
  if (reportInflight?.generation === generation) return reportInflight.promise
  const promise = computeReport().finally(() => {
    if (reportInflight?.promise === promise) reportInflight = null
  })
  reportInflight = { generation, promise }
  return promise
}

async function computeReport() {
  const state = await getMomentumState()
  const universe = await listUniverse()
  if (!state.config.active) {
    return {
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
      locks: await listLocks(),
    }
  }
  const symbols = await rankedSymbols(universe, state.config, previousIstDate(new Date()))
  const holdings = await holdingsFor("MOMENTUM")
  const locks = await listLocks()
  const plan = buildMomentumPlan({
    symbols,
    config: state.config,
    holdings,
    locks,
    asOf: previousIstDate(new Date()),
  })
  const names = new Map(universe.map(row => [row.symbol, row.name]))
  return {
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
  }
}

export default withSession(async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized")
  try {
    if (req.method === "GET") {
      return res.json(await report())
    }
    if (req.method === "PUT") {
      const config = normalizeMomentumConfig(req.body?.config ?? req.body)
      rankGeneration += 1
      const saved = await saveMomentumConfig(config)
      return res.json(saved)
    }
    if (req.method === "POST" && req.body?.action === "replace-universe") {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : []
      const count = await replaceUniverse(
        rows
          .map((row: { symbol?: string; name?: string }) => ({
            symbol: normalizeNseCashSymbol(String(row.symbol || "")) || "",
            name: row.name,
          }))
          .filter((row: { symbol: string }) => row.symbol.length > 0)
      )
      return res.json({ count })
    }
    if (req.method === "POST" && req.body?.action === "lock") {
      const symbol = String(req.body.symbol || "").toUpperCase()
      if (req.body.clear === true) {
        await saveLock({ symbol, clear: true })
      } else {
        const mode = req.body.mode === "EXCLUDE" ? "EXCLUDE" : "HOLD_WEIGHT"
        await saveLock({ symbol, mode, weightPct: Number(req.body.weightPct) || 0 })
      }
      return res.json(await report())
    }
    if (req.method === "POST" && req.body?.action === "pull") {
      if (req.body.config) await saveMomentumConfig(normalizeMomentumConfig(req.body.config))
      const state = await getMomentumState()
      if (!state.config.active) {
        return res.status(409).json({
          error:
            "Strategy on is saved as off. Turn Strategy on on this page. Desk → Risk does not start the history pull. This button saves the switches on the page, then pulls.",
        })
      }
      const token = req.session.user.session?.access_token
      return res.json(await pullCashHistory({ accessToken: token, force: true }))
    }
    if (req.method === "POST" && req.body?.action === "rebalance") {
      const snapshot = await report()
      if (!snapshot.active) return res.status(409).json({ error: "Strategy is off" })
      const execute = req.body.execute === true
      const due = "due" in snapshot ? Boolean(snapshot.due) : false
      const orders = executableOrders(
        { ranked: [], targets: snapshot.targets, orders: snapshot.orders },
        { execution: snapshot.config.execution, executeRequested: execute, due }
      )
      if (!execute) return res.json({ preview: true, orders: snapshot.orders, due })
      if (!orders.length && snapshot.config.execution === "report") {
        return res.status(409).json({
          error: "Execution is report-only. Change it to manual or auto before sending orders.",
        })
      }
      const token = req.session.user.session?.access_token
      const results = await submitCashOrders({ accessToken: token, strategy: "MOMENTUM", orders })
      await markMomentumRebalance(istDate(new Date()))
      return res.json({ results, orders })
    }
    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    return sendApiError(res, error, logger, "momentum")
  }
})
