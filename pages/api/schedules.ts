import dayjs from "dayjs"
import { and, eq } from "drizzle-orm"
import type { NextApiRequest, NextApiResponse } from "next"
import { sendApiError } from "../../lib/apiErrors"
import { db } from "../../lib/drizzle"
import { istToday } from "../../lib/drizzleIst"
import { enqueueTradeJob } from "../../lib/enqueueTradeJob"
import logger from "../../lib/logger"
import { dueScheduleRunsNow } from "../../lib/operatorActionCopy"
import { mapPlanFromDb } from "../../lib/planMapper"
import { jobExecutions, strategySchedules, strategyTemplates } from "../../lib/schema"
import withSession from "../../lib/session"
import { deleteSchedule, saveSchedule, templateToJobBody } from "../../lib/strategyTemplates"
import { templateBlockedByJob } from "../../lib/trading/scheduleGuard"

export default withSession(async (req: NextApiRequest, res: NextApiResponse) => {
  const user = req.session.user
  if (!user) return res.status(401).end()

  try {
    if (req.method === "GET") {
      const day = dayjs().format("dddd").toUpperCase()
      const rows = await db
        .select({
          schedule: strategySchedules,
          template: strategyTemplates,
        })
        .from(strategySchedules)
        .innerJoin(strategyTemplates, eq(strategySchedules.templateId, strategyTemplates.id))
        .where(
          and(eq(strategySchedules.dayOfWeek, day as never), eq(strategySchedules.enabled, true))
        )
      const jobs = await db
        .select({ templateId: jobExecutions.templateId, status: jobExecutions.status })
        .from(jobExecutions)
        .where(istToday(jobExecutions.createdAt))
      const queued = new Set(
        jobs
          .filter(row => templateBlockedByJob(row.status))
          .map(row => row.templateId)
          .filter(Boolean)
      )
      return res.json(
        rows
          .filter(row => !queued.has(row.schedule.templateId))
          .map(row => ({
            ...row.schedule,
            template: mapPlanFromDb(row.template),
          }))
      )
    }

    if (req.method === "POST") {
      if (req.body?.action === "today") {
        const templateId = String(req.body.templateId || "")
        const [template] = await db
          .select()
          .from(strategyTemplates)
          .where(eq(strategyTemplates.id, templateId))
        if (!template) return res.status(404).json({ error: "Template not found" })
        const runAt = req.body.runAt || template.runAt
        const runNow =
          req.body.runNow === true || dueScheduleRunsNow(new Date(), runAt ? String(runAt) : null)
        const body = templateToJobBody(mapPlanFromDb(template) as Record<string, unknown>, {
          runNow,
          runAt,
          dayOfWeek: dayjs().format("dddd").toUpperCase(),
        })
        const result = await enqueueTradeJob(user, body)
        return result.ok ? res.json(result.job) : res.status(result.status).json(result)
      }
      const result = await saveSchedule({
        templateId: String(req.body?.templateId || ""),
        dayOfWeek: String(req.body?.dayOfWeek || ""),
        runAt: req.body?.runAt,
        enabled: req.body?.enabled,
      })
      return result.ok ? res.json(result.schedule) : res.status(result.status).json(result)
    }

    if (req.method === "DELETE") {
      const result = await deleteSchedule(String(req.body?.id || req.query.id || ""))
      return res.json(result)
    }

    return res.status(405).end()
  } catch (e) {
    return sendApiError(res, e, logger, "schedules")
  }
})
