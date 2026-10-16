import { desc, eq } from "drizzle-orm"
import { sendApiError } from "../../lib/apiErrors"
import { JOB_EXECUTION_STATUS, USER_OVERRIDE } from "../../lib/constants"
import { toClientJobExecution } from "../../lib/dashboardJobActions"
import { db } from "../../lib/drizzle"
import { istToday } from "../../lib/drizzleIst"
import { abortJobExecution, forceRemoveQueuedJob } from "../../lib/jobControl"
import logger from "../../lib/logger"
import { jobExecutions } from "../../lib/schema"

import withSession from "../../lib/session"
import { validateTradeJobPayload } from "../../lib/strategyValidation"

function parseAbortOverride(body: Record<string, unknown>): string | null {
  const override = body.userOverride ?? body.user_override
  if (override == null) return null
  if (override === USER_OVERRIDE.ABORT) return USER_OVERRIDE.ABORT
  return null
}

export default withSession(async (req, res) => {
  const user = req.session.user

  if (!user) {
    return res.status(401).end()
  }

  if (req.method === "POST") {
    const { getMaxLotsForStrategy } = await import("../../lib/trading/riskSettings")
    const validation = validateTradeJobPayload(req.body, {
      maxLots: await getMaxLotsForStrategy((req.body as { strategy?: string }).strategy),
    })
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error })
    }

    const { enqueueTradeJob } = await import("../../lib/enqueueTradeJob")
    const result = await enqueueTradeJob(user, req.body as Record<string, unknown>)
    if (!result.ok) {
      if (result.status === 409) {
        return res.status(409).json({
          id: result.id,
          orderTag: result.orderTag,
          status: JOB_EXECUTION_STATUS.REJECT,
          error: result.error,
          code: result.code,
        })
      }
      return res.status(result.status).json({ error: result.error, code: result.code })
    }
    return res.json(result.job)
  }

  if (req.method === "DELETE") {
    try {
      const jobId = req.body?.id as string
      if (!jobId) {
        return res.status(400).json({ error: "id is required" })
      }
      const rows = await db
        .select({ queue: jobExecutions.queue })
        .from(jobExecutions)
        .where(eq(jobExecutions.id, jobId))

      if (rows.length === 0) {
        return res.status(404).json({ error: "Job not found" })
      }

      const queueInfo = rows[0]?.queue as { id?: string } | undefined
      if (queueInfo?.id) {
        await forceRemoveQueuedJob(queueInfo.id)
      }

      await db.delete(jobExecutions).where(eq(jobExecutions.id, jobId))
      return res.end()
    } catch (e) {
      return sendApiError(res, e, logger, "trades_day DELETE")
    }
  }

  if (req.method === "PUT") {
    try {
      const { id } = req.body || {}
      if (!id) {
        return res.status(400).json({ error: "id is required" })
      }
      if (req.body.status != null) {
        return res
          .status(400)
          .json({ error: "status cannot be set directly; use userOverride ABORT" })
      }

      const abortOverride = parseAbortOverride(req.body)
      if (abortOverride === USER_OVERRIDE.ABORT) {
        await abortJobExecution(id)
        return res.end()
      }

      const override = req.body.userOverride ?? req.body.user_override
      if (override != null) {
        return res.status(400).json({ error: "Only userOverride ABORT is allowed" })
      }

      return res.status(400).json({ error: "userOverride ABORT is required" })
    } catch (e) {
      return sendApiError(res, e, logger, "trades_day PUT")
    }
  }

  if (req.method === "GET") {
    try {
      const results = await db
        .select()
        .from(jobExecutions)
        .where(istToday(jobExecutions.createdAt))
        .orderBy(desc(jobExecutions.createdAt))
      return res.json(results.map(row => toClientJobExecution(row)))
    } catch (e) {
      return sendApiError(res, e, logger, "trades_day GET")
    }
  }

  res.status(400).end()
})
