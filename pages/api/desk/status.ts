import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

import { sendApiError } from "../../../lib/apiErrors"
import logger from "../../../lib/logger"
import { IST_TZ, isNonTradingDay, marketSessionState, sessionBounds } from "../../../lib/marketCalendar"
import withSession from "../../../lib/session"
import { listOperatorAlerts } from "../../../lib/trading/alerts"
import { signedQty } from "../../../lib/trading/accounting"
import { getOpenPositions } from "../../../lib/trading/ledger"
import { RISK_STRATEGY_KEYS, type RiskStrategyKey } from "../../../lib/trading/riskEngine"
import { getRiskSettings } from "../../../lib/trading/riskSettings"
import { isMockOrder } from "../../../lib/utils"

dayjs.extend(utc)
dayjs.extend(timezone)

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  try {
    const now = new Date()
    const ist = dayjs(now).tz(IST_TZ)
    const settings = await getRiskSettings()
    const openRows = await getOpenPositions()
    const strategies = {} as Record<
      RiskStrategyKey,
      {
        enabled: boolean
        halted: boolean
        haltReason: string | null
        executionMode: "PAPER" | "LIVE"
        openPositions: number
      }
    >

    for (const key of RISK_STRATEGY_KEYS) {
      const row = settings.strategies[key]
      const openPositions = openRows.filter(
        r => r.strategy === key && signedQty(r.quantity) !== 0
      ).length
      strategies[key] = {
        enabled: row.enabled,
        halted: row.halted,
        haltReason: row.haltReason,
        executionMode: row.executionMode,
        openPositions,
      }
    }

    const session = marketSessionState(now)
    const bounds = sessionBounds(now)
    let nextChangeIst: string | null = null
    if (bounds) {
      if (session === "PRE_MARKET" || session === "CLOSED" || session === "OVERNIGHT") {
        nextChangeIst = bounds.open.toDate().toISOString()
      } else if (session === "OPEN") {
        nextChangeIst = bounds.close.toDate().toISOString()
      }
    }

    const alertSummary = await listOperatorAlerts(40, "today")

    return res.json({
      serverTimeIst: ist.toISOString(),
      market: {
        session,
        nextChangeIst,
        isTradingDay: !isNonTradingDay(ist),
      },
      mockOrders: isMockOrder(),
      allowLiveOrders: settings.allowLiveOrders,
      tradingEnabled: settings.tradingEnabled,
      deskHalted: settings.deskHalted,
      haltReason: settings.haltReason,
      strategies,
      alerts: {
        errorCount: alertSummary.errorCount,
        warnCount: alertSummary.warnCount,
      },
    })
  } catch (e) {
    return sendApiError(res, e, logger, "desk/status")
  }
})
