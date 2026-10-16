import { sendApiError } from "../../lib/apiErrors"
import logger from "../../lib/logger"
import { istDate } from "../../lib/momentum/calendar"
import { executableOrders } from "../../lib/momentum/engine"
import { submitCashOrders } from "../../lib/momentum/execute"
import { cashPullProgress, progressForPage, startCashHistoryPull } from "../../lib/momentum/history"
import {
  acceptConstituentChange,
  dismissConstituentChange,
  listMomentumConstituents,
  refreshIndexMembership,
  settlePendingConstituents,
} from "../../lib/momentum/membershipRefresh"
import {
  getMomentumState,
  markMomentumRebalance,
  replaceUniverse,
  saveLock,
  saveMomentumConfig,
} from "../../lib/momentum/store"
import { getMomentumReport } from "../../lib/momentum/storedReport"
import { normalizeMomentumConfig } from "../../lib/momentum/types"
import { normalizeNseCashSymbol } from "../../lib/nseCashSymbol"
import withSession from "../../lib/session"

export default withSession(async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized")
  try {
    if (req.method === "GET" && req.query.view === "pull") {
      return res.json(progressForPage("momentum", cashPullProgress()))
    }
    if (req.method === "GET") {
      const report = await getMomentumReport()
      return res.json({
        ...report,
        constituents: await listMomentumConstituents(),
      })
    }
    if (req.method === "PUT") {
      const config = normalizeMomentumConfig(req.body?.config ?? req.body)
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
      return res.json({ ok: true })
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
      return res.json(
        startCashHistoryPull({
          accessToken: token,
          force: true,
          scope: "momentum",
          onlyMissing: req.body?.onlyMissing === true,
        })
      )
    }
    if (req.method === "POST" && req.body?.action === "refresh-constituents") {
      const result = await refreshIndexMembership("NIFTY_TOTAL_MARKET", { force: true })
      return res.json({
        ...result,
        constituents: await listMomentumConstituents(),
        message: result.kept
          ? "The index site did not return a file. Your rank list was left as it is."
          : undefined,
      })
    }
    if (req.method === "POST" && req.body?.action === "accept-constituent") {
      await acceptConstituentChange(Number(req.body.id))
      return res.json({ constituents: await listMomentumConstituents() })
    }
    if (req.method === "POST" && req.body?.action === "dismiss-constituent") {
      await dismissConstituentChange(Number(req.body.id))
      return res.json({ constituents: await listMomentumConstituents() })
    }
    if (
      req.method === "POST" &&
      (req.body?.action === "accept-constituents" || req.body?.action === "dismiss-constituents")
    ) {
      const side = req.body.side === "REMOVE" ? "REMOVE" : "ADD"
      await settlePendingConstituents(
        "NIFTY_TOTAL_MARKET",
        side,
        req.body.action === "accept-constituents" ? "ACCEPTED" : "DISMISSED"
      )
      return res.json({ constituents: await listMomentumConstituents() })
    }
    if (req.method === "POST" && req.body?.action === "rebalance") {
      const snapshot = await getMomentumReport({ fresh: true })
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
    if (req.method === "POST" && (req.body?.action === "deploy" || req.body?.action === "trim")) {
      const trimming = req.body.action === "trim"
      const trimPct = Number(req.body.trimPct)
      if (trimming && !(trimPct > 0 && trimPct < 100)) {
        return res.status(400).json({ error: "Trim percent must be between 0 and 100." })
      }
      const snapshot = await getMomentumReport(
        trimming ? { fresh: true, trimPct } : { fresh: true, deployCash: true }
      )
      if (!snapshot.active) return res.status(409).json({ error: "Strategy is off" })
      if (snapshot.config.weighting !== "drift") {
        return res.status(409).json({ error: "Weights must be Let winners run." })
      }
      const execute = req.body.execute === true
      const orders = executableOrders(
        { ranked: [], targets: snapshot.targets, orders: snapshot.orders },
        { execution: snapshot.config.execution, executeRequested: execute, due: false }
      )
      if (!execute) return res.json({ preview: true, orders: snapshot.orders })
      if (snapshot.config.execution === "report") {
        return res.status(409).json({
          error: "Execution is report-only. Change it to manual or auto before sending orders.",
        })
      }
      const token = req.session.user.session?.access_token
      const results = await submitCashOrders({ accessToken: token, strategy: "MOMENTUM", orders })
      if (trimming) {
        await saveMomentumConfig({
          ...snapshot.config,
          capitalInr: Math.floor(snapshot.config.capitalInr * (1 - trimPct / 100)),
        })
      }
      return res.json({ results, orders })
    }
    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    return sendApiError(res, error, logger, "momentum")
  }
})
