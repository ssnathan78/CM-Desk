import { sendApiError } from "../../lib/apiErrors"
import { jobMatchesKillScope } from "../../lib/dashboardJobActions"
import { type KillDeskScope, runDeskKill } from "../../lib/killDesk"
import { killOperatorNotice, killResponseStatus } from "../../lib/killNotice"
import logger from "../../lib/logger"
import withSession from "../../lib/session"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) {
    return res.status(401).send("Unauthorized")
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const scope = req.body?.scope as KillDeskScope
  if (scope !== "intraday" && scope !== "all") {
    return res.status(400).json({ error: "scope must be intraday or all" })
  }

  try {
    const result = await runDeskKill(scope, user)
    logger.info("[api/kill-desk]", {
      ...result,
      chaseKept: jobMatchesKillScope("CHASE", scope) === false,
    })
    const notice = killOperatorNotice({
      scope,
      liveLeftOpen: result.liveLeftOpen,
      chasePaused: result.chasePaused,
      deskHalted: result.deskHalted,
    })
    const status = killResponseStatus(result.deskHalted)
    if (status === 500) {
      return res.status(500).json({
        ...result,
        error: notice?.text || "The desk halt was not saved.",
      })
    }
    return res.json(result)
  } catch (e) {
    return sendApiError(res, e, logger, "kill-desk")
  }
})
