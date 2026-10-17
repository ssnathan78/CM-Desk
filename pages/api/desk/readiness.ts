import { sendApiError } from "../../../lib/apiErrors"
import logger from "../../../lib/logger"
import { marketSessionState } from "../../../lib/marketCalendar"
import withSession from "../../../lib/session"
import { signedQty } from "../../../lib/trading/accounting"
import { type DeskReadinessInput, evaluateDeskReadiness } from "../../../lib/trading/deskReadiness"
import { getOpenPositions } from "../../../lib/trading/ledger"
import { RISK_STRATEGY_KEYS } from "../../../lib/trading/riskEngine"
import { getRiskSettings } from "../../../lib/trading/riskSettings"
import { isMockOrder } from "../../../lib/utils"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  try {
    const now = new Date()
    const settings = await getRiskSettings()
    const openRows = await getOpenPositions()
    let paperOpen = 0
    let liveOpen = 0
    for (const row of openRows) {
      if (signedQty(row.quantity) === 0) continue
      const prov = String(row.provenance || "")
      if (prov === "PAPER" || prov === "MOCK") paperOpen += 1
      else liveOpen += 1
    }

    const strategies = {} as DeskReadinessInput["strategies"]
    for (const key of RISK_STRATEGY_KEYS) {
      const row = settings.strategies[key]
      const openPositions = openRows.filter(
        r => r.strategy === key && signedQty(r.quantity) !== 0
      ).length
      strategies[key] = {
        enabled: row.enabled,
        halted: row.halted,
        executionMode: row.executionMode,
        openPositions,
      }
    }

    const kiteSessionOk = Boolean(user.session?.access_token)

    const result = evaluateDeskReadiness({
      mockOrders: isMockOrder(),
      allowLiveOrders: settings.allowLiveOrders,
      tradingEnabled: settings.tradingEnabled,
      deskHalted: settings.deskHalted,
      haltReason: settings.haltReason,
      kiteSessionOk,
      strategies,
      paperOpenPositions: paperOpen,
      liveOpenPositions: liveOpen,
      marketSession: marketSessionState(now),
      requireMarketHours: settings.requireMarketHours,
    })

    return res.json(result)
  } catch (e) {
    return sendApiError(res, e, logger, "desk/readiness")
  }
})
