import type { NextApiRequest, NextApiResponse } from "next"
import { sendApiError } from "../../lib/apiErrors"
import logger from "../../lib/logger"
import withSession from "../../lib/session"
import {
  deleteTemplate,
  duplicateTemplate,
  editPendingJob,
  listTemplates,
  saveTemplate,
  updateJobFromTemplate,
} from "../../lib/strategyTemplates"
import { validatePlanConfig } from "../../lib/strategyValidation"

export default withSession(async (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.session.user) return res.status(401).end()

  try {
    if (req.method === "GET") {
      return res.json(await listTemplates())
    }

    if (req.method === "POST") {
      const action = req.body?.action
      if (action === "duplicate") {
        const result = await duplicateTemplate(String(req.body?.id || ""))
        return result.ok ? res.json(result.template) : res.status(result.status).json(result)
      }
      if (action === "update-job") {
        const result = await updateJobFromTemplate(String(req.body?.jobId || ""))
        return result.ok ? res.json(result.job) : res.status(result.status).json(result)
      }
      if (action === "edit-job") {
        const result = await editPendingJob(String(req.body?.jobId || ""), req.body?.config || {})
        return result.ok ? res.json(result.job) : res.status(result.status).json(result)
      }
      const config = req.body?.config || req.body
      const { getMaxLotsForStrategy } = await import("../../lib/trading/riskSettings")
      const validation = validatePlanConfig(config, {
        maxLots: await getMaxLotsForStrategy(config?.strategy),
      })
      if (!validation.ok) return res.status(400).json({ error: validation.error })
      const result = await saveTemplate(config)
      return result.ok ? res.json(result.template) : res.status(result.status).json(result)
    }

    if (req.method === "PUT") {
      const config = req.body?.config || req.body
      const id = String(config?.id || req.body?.id || "")
      const { getMaxLotsForStrategy } = await import("../../lib/trading/riskSettings")
      const validation = validatePlanConfig(config, {
        maxLots: await getMaxLotsForStrategy(config?.strategy),
      })
      if (!validation.ok) return res.status(400).json({ error: validation.error })
      const result = await saveTemplate(config, id)
      return result.ok ? res.json(result.template) : res.status(result.status).json(result)
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "")
      const result = await deleteTemplate(id)
      return result.ok ? res.json({ ok: true }) : res.status(result.status).json(result)
    }

    return res.status(405).end()
  } catch (e) {
    return sendApiError(res, e, logger, "templates")
  }
})
