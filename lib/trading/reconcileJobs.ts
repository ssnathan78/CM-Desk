import { and, eq, inArray } from "drizzle-orm"

import { db } from "../drizzle"
import { istToday } from "../drizzleIst"
import logger from "../logger"
import { tradingQueue } from "../queue"
import { jobExecutions } from "../schema"
import { recordOperatorAlert } from "./alerts"
import { jobNeedsReconcile } from "./scheduleGuard"

/** Fail today's Pending/Queue rows whose Redis job is gone, so the due list can show the template again. */
export async function reconcileOpenJobs(now = Date.now()) {
  const rows = await db
    .select()
    .from(jobExecutions)
    .where(
      and(istToday(jobExecutions.createdAt), inArray(jobExecutions.status, ["PENDING", "QUEUE"]))
    )

  for (const row of rows) {
    const queue = (row.queue ?? {}) as { id?: unknown; type?: unknown }
    const queueId = typeof queue.id === "string" ? queue.id : ""
    const queueType = typeof queue.type === "string" ? queue.type : null
    const hasQueueId = queueId.length > 0
    let queueJobMissing = false
    if (queueType !== "chase" && hasQueueId && queueId !== row.id) {
      try {
        const job = await tradingQueue.getJob(queueId)
        queueJobMissing = !job
      } catch (error) {
        logger.warn("[reconcile] redis lookup failed — leaving the job in place", error)
        queueJobMissing = false
      }
    }
    const decision = jobNeedsReconcile({
      status: row.status,
      ageMs: now - new Date(row.createdAt).getTime(),
      hasQueueId,
      queueType,
      queueJobMissing,
    })
    if (decision !== "fail") continue
    await db
      .update(jobExecutions)
      .set({
        status: "FAILED",
        queue: { ...queue, failedReason: "Queue job missing after restart" },
      })
      .where(eq(jobExecutions.id, row.id))
    await recordOperatorAlert({
      source: "JOB",
      code: "JOB_LOST",
      severity: "ERROR",
      summary: "A scheduled job was still pending and its queue entry is gone",
      jobId: row.id,
      strategy: row.strategy,
      instrument: row.instrument,
      idempotencyKey: `alert:job-lost:${row.id}`,
    })
    logger.error(`[reconcile] marked job ${row.id} failed — queue entry missing`)
  }
}
