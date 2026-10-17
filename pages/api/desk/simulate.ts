import { sendApiError } from "../../../lib/apiErrors"
import logger from "../../../lib/logger"
import withSession from "../../../lib/session"
import { isSimUiAllowed } from "../../../lib/simulation/allowSimUi"
import { listScenarios } from "../../../lib/simulation/catalog"
import { formatSimReport, simFailed } from "../../../lib/simulation/report"
import { simulate } from "../../../lib/simulation/runner"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (!isSimUiAllowed()) {
    return res.status(403).json({ error: "Simulation UI is disabled in production" })
  }

  if (req.method === "GET") {
    return res.json({ scenarios: listScenarios() })
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  try {
    const body = req.body as { scenario?: string; seed?: number }
    const scenario = String(body.scenario || "").trim()
    if (!scenario) return res.status(400).json({ error: "scenario is required" })
    const known = listScenarios()
    if (!known.includes(scenario)) {
      return res.status(400).json({ error: "Unknown scenario", scenarios: known.slice(0, 20) })
    }
    const result = simulate({
      scenario,
      seed: typeof body.seed === "number" ? body.seed : undefined,
    })
    const report = formatSimReport(result)
    return res.json({
      ok: !simFailed(result),
      scenario,
      report,
      summary: {
        failed: simFailed(result),
        events: result.journal?.length ?? 0,
        violations: result.invariantViolations?.length ?? 0,
      },
    })
  } catch (e) {
    return sendApiError(res, e, logger, "desk/simulate")
  }
})
