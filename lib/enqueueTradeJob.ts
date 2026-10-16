import dayjs from "dayjs"
import { eq } from "drizzle-orm"
import { customAlphabet } from "nanoid"
import type { KiteUser } from "../types/misc"
import type { SUPPORTED_TRADE_CONFIG } from "../types/trade"
import { JOB_EXECUTION_STATUS } from "./constants"
import { db } from "./drizzle"
import { mapJobExecutionInsert, mapJobExecutionQueuePayload } from "./jobExecutionMapper"
import logger from "./logger"
import { addToChaseQueue, addToNextQueue, TRADING_Q_NAME } from "./queue"
import { jobExecutions, tradePlans } from "./schema"
import { validateTradeJobPayload } from "./strategyValidation"
import { liveScheduleRejectReason, recordOperatorAlert, scheduleRejectCode } from "./trading/alerts"
import { isMarketOpen, isMockOrder } from "./utils"

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 8)

function logJobSchedule(body: Record<string, unknown>) {
  logger.info("[enqueueTradeJob] schedule", {
    strategy: body.strategy,
    instrument: body.instrument,
    lots: body.lots,
    runNow: body.runNow,
    templateId: body.templateId,
  })
}

async function createJob({ jobData, user }: { jobData: SUPPORTED_TRADE_CONFIG; user: KiteUser }) {
  const { runAt, runNow } = jobData
  const scheduleReject = liveScheduleRejectReason({
    isMock: isMockOrder(),
    runNow: Boolean(runNow),
    runAt,
    marketOpenNow: isMarketOpen(),
    marketOpenAtRunAt: runAt ? isMarketOpen(dayjs(runAt)) : true,
  })
  if (scheduleReject) {
    return Promise.reject(
      Object.assign(new Error(scheduleReject.message), { code: scheduleReject.code })
    )
  }
  return addToNextQueue({ ...jobData, user }, { _nextTradingQueue: TRADING_Q_NAME })
}

export async function enqueueTradeJob(user: KiteUser, body: Record<string, unknown>) {
  const { getMaxLotsForStrategy } = await import("./trading/riskSettings")
  const validation = validateTradeJobPayload(body, {
    maxLots: await getMaxLotsForStrategy(body.strategy as string | undefined),
  })
  if (!validation.ok) {
    return { ok: false as const, status: 400, error: validation.error }
  }

  const orderTag = nanoid()
  logJobSchedule(body)
  const templateId = typeof body.templateId === "string" ? body.templateId : null
  let planRef = typeof body.planRef === "string" ? body.planRef : templateId
  if (planRef) {
    const [plan] = await db
      .select({ id: tradePlans.id })
      .from(tradePlans)
      .where(eq(tradePlans.id, planRef))
    if (!plan) planRef = null
  }
  const inserted = await db
    .insert(jobExecutions)
    .values({
      ...mapJobExecutionInsert({
        ...body,
        templateId,
        planRef,
      }),
      orderTag,
      status: JOB_EXECUTION_STATUS.PENDING,
      createdAt: new Date(),
    })
    .returning()

  const executionData = inserted[0]
  if (!executionData) throw new Error("Failed to insert job execution")

  const queuePayload = mapJobExecutionQueuePayload(body, executionData, orderTag)
  try {
    if (executionData.strategy === "CHASE") {
      await addToChaseQueue(user)
      await db
        .update(jobExecutions)
        .set({ status: JOB_EXECUTION_STATUS.QUEUE, queue: { id: executionData.id, type: "chase" } })
        .where(eq(jobExecutions.id, executionData.id))
      return { ok: true as const, job: executionData }
    }

    const qRes = await createJob({
      jobData: queuePayload as unknown as SUPPORTED_TRADE_CONFIG,
      user,
    })
    if (!qRes) throw new Error("Failed to enqueue job")
    await db
      .update(jobExecutions)
      .set({
        status: JOB_EXECUTION_STATUS.QUEUE,
        queue: { id: qRes.id, name: qRes.name, opts: qRes.opts, timestamp: qRes.timestamp },
      })
      .where(eq(jobExecutions.id, executionData.id))
    return { ok: true as const, job: executionData }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const code =
      e && typeof e === "object" && "code" in e && typeof e.code === "string"
        ? e.code
        : scheduleRejectCode(message)
    await db
      .update(jobExecutions)
      .set({ status: JOB_EXECUTION_STATUS.REJECT, queue: { error: message, code } })
      .where(eq(jobExecutions.id, executionData.id))
    await recordOperatorAlert({
      source: "SCHEDULE",
      code,
      severity: "ERROR",
      summary: message,
      jobId: executionData.id,
      strategy: typeof executionData.strategy === "string" ? executionData.strategy : null,
      instrument: typeof executionData.instrument === "string" ? executionData.instrument : null,
      idempotencyKey: `alert:schedule:${executionData.id}`,
    })
    return {
      ok: false as const,
      status: 409,
      error: message,
      code,
      id: executionData.id,
      orderTag: executionData.orderTag,
    }
  }
}
