import { randomUUID } from "node:crypto"
import { type Job, type JobsOptions, Queue } from "bullmq"
import dayjs from "dayjs"
import IORedis from "ioredis"

import logger from "./logger"
import { followUpJobId, isDuplicateJobError } from "./trading/brokerPlace"
import {
  getBackoffStrategy,
  getEntryAttemptsCount,
  getMisOrderLastSquareOffTime,
  getQueueOptionsForExitStrategy,
  getTimeLeftInMarketClosingMs,
  isMockOrder,
  ms,
} from "./utils"

export type QueuePayload<Data = any, Response = any> = {
  initialJobData: Data
  jobResponse: Response & { _nextTradingQueue?: string }
}

const redisUrl = `${process.env.REDIS_URL as string}`

// just a hack to ensure if someone left a placeholder in env variables
export const QID: string = process.env.KITE_API_KEY!
export const TRADING_Q_NAME = `tradingQueue_${QID}`
export const EXIT_TRADING_Q_NAME = `exitTradingQueue_${QID}`
export const AUTO_SQUARE_OFF_Q_NAME = `autoSquareOffQueue_${QID}`
export const ANCILLARY_Q_NAME = `ancillaryQueue_${QID}`
export const TARGETPNL_Q_NAME = `targetPnlQueue_${QID}`
export const CHASE_Q_NAME = `chaseQueue_${QID}`
export const redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
const queueOptions = {
  connection: redisConnection,
}

export const tradingQueue = new Queue(TRADING_Q_NAME, queueOptions)
export const targetPnLQueue = new Queue(TARGETPNL_Q_NAME, queueOptions)
export const exitTradesQueue = new Queue(EXIT_TRADING_Q_NAME, queueOptions)
export const autoSquareOffQueue = new Queue(AUTO_SQUARE_OFF_Q_NAME, queueOptions)
export const ancillaryQueue = new Queue(ANCILLARY_Q_NAME, queueOptions)
export const chaseQueue = new Queue(CHASE_Q_NAME, queueOptions)

const allQueues = [
  tradingQueue, // Orders are punched here
  exitTradesQueue, // Stop loss orders or combined SL orders are punched
  autoSquareOffQueue, // Square off is punched in this queue
  ancillaryQueue, //Orderbook sync to DB is done here
  targetPnLQueue, //For target loss or profit
  chaseQueue, //For chase orders
]

function executionIdFrom(jobData): string | null {
  const id = jobData?.id || jobData?.initialJobData?.id
  return typeof id === "string" && id ? id : null
}

async function addQueueJob(queue: Queue, name: string, data: unknown, opts: JobsOptions) {
  try {
    return await queue.add(name, data, opts)
  } catch (error) {
    if (opts.jobId && isDuplicateJobError(error)) return undefined
    throw error
  }
}

export async function addToNextQueue(jobData, jobResponse): Promise<Job | undefined> {
  const executionId = executionIdFrom(jobData)
  switch (jobResponse._nextTradingQueue) {
    case ANCILLARY_Q_NAME: {
      const marketClosing = dayjs().set("hours", 15).set("minutes", 30).set("seconds", 0)
      return addQueueJob(
        ancillaryQueue,
        `${ANCILLARY_Q_NAME}_${randomUUID()}`,
        {
          initialJobData: jobData,
          jobResponse,
        },
        {
          delay: marketClosing.diff(dayjs()),
        }
      )
    }

    case EXIT_TRADING_Q_NAME: {
      const queueOptions = getQueueOptionsForExitStrategy(jobData.exitStrategy)
      if (executionId) queueOptions.jobId = followUpJobId("exit", executionId)
      return addQueueJob(
        exitTradesQueue,
        `${EXIT_TRADING_Q_NAME}_${randomUUID()}`,
        {
          initialJobData: jobData,
          jobResponse,
        },
        queueOptions
      )
    }
    case TRADING_Q_NAME: {
      const { strategy, runNow, runAt } = jobData
      const queueOptions: JobsOptions = {
        attempts: getEntryAttemptsCount({ strategy }) || 3,
        backoff: {
          type: getBackoffStrategy({ strategy }),
          delay: ms(15),
        },
      }

      if (!runNow) {
        const delay = dayjs(runAt).diff(dayjs())
        queueOptions.delay = delay
      }

      return addQueueJob(tradingQueue, `${TRADING_Q_NAME}_${randomUUID()}`, jobData, queueOptions)
    }
    case TARGETPNL_Q_NAME: {
      logger.info(`[queue] added to ${TARGETPNL_Q_NAME}`)
      return addQueueJob(
        targetPnLQueue,
        `${TARGETPNL_Q_NAME}_${randomUUID()}`,
        {
          initialJobData: jobData,
          jobResponse,
        },
        {
          attempts: Math.ceil(getTimeLeftInMarketClosingMs() / ms(3)),
          backoff: {
            type: "fixed",
            delay: ms(4),
          },
          ...(executionId ? { jobId: followUpJobId("target", executionId) } : {}),
        }
      )
    }

    default: {
      return undefined
    }
  }
}

export async function addToAutoSquareOffQueue({ initialJobData, jobResponse }) {
  const {
    autoSquareOffProps: { time, deletePendingOrders },
  } = initialJobData
  const { rawKiteOrdersResponse, squareOffOrders } = jobResponse
  const finalOrderTime = getMisOrderLastSquareOffTime()
  const runAtTime = isMockOrder()
    ? time
    : dayjs(time).isAfter(dayjs(finalOrderTime))
      ? finalOrderTime
      : time

  const delay = dayjs(runAtTime).diff(dayjs())
  // console.log(`>>> auto square off scheduled for ${Math.ceil(delay / 60000)} minutes from now`)
  const executionId = executionIdFrom(initialJobData)
  return addQueueJob(
    autoSquareOffQueue,
    `${AUTO_SQUARE_OFF_Q_NAME}_${randomUUID()}`,
    {
      rawKiteOrdersResponse: squareOffOrders || rawKiteOrdersResponse,
      deletePendingOrders,
      initialJobData,
    },
    {
      delay,
      ...(executionId ? { jobId: followUpJobId("aso", executionId) } : {}),
    }
  )
}

export async function addToCoSquareOff(user) {
  const today = dayjs().format("YYYY-MM-DD")
  const marketClosingforEquity = dayjs().set("hours", 15).set("minutes", 10).set("seconds", 0)
  const delay = Math.max(0, marketClosingforEquity.diff(dayjs()))
  return addQueueJob(
    autoSquareOffQueue,
    `${AUTO_SQUARE_OFF_Q_NAME}_${today}`,
    {
      user,
    },
    {
      delay,
      jobId: `co-${today}`,
    }
  )
}
export async function addToAncillaryQueue(user) {
  const today = dayjs().format("YYYY-MM-DD")
  const marketClosing = dayjs().set("hours", 15).set("minutes", 30).set("seconds", 0)

  return addQueueJob(ancillaryQueue, `${ANCILLARY_Q_NAME}_${today}`, user, {
    delay: marketClosing.diff(dayjs()),
    jobId: `ancillary-${today}`,
  })
}

export const cleanupQueues = async () =>
  await Promise.all(allQueues.map(async queue => await queue.obliterate({ force: true })))

export const CHASE_EMA_SCHEDULER_ID = "chase-calculateEMA"
export const CHASE_UPDATE_SL_SCHEDULER_ID = "chase-updateSL"

export async function addToChaseQueue(user: any) {
  const today = dayjs().format("YYYY-MM-DD")
  try {
    await chaseQueue.upsertJobScheduler(
      CHASE_EMA_SCHEDULER_ID,
      {
        pattern: "15 10-16 * * *",
        startDate: new Date(`${today}T10:14:00+05:30`),
        endDate: new Date(`${today}T16:15:00+05:30`),
        tz: "Asia/Kolkata",
      },
      {
        name: "calculateEMA",
        data: { user },
      }
    )

    await chaseQueue.upsertJobScheduler(
      CHASE_UPDATE_SL_SCHEDULER_ID,
      {
        pattern: "0 * 9-15 * * *",
        startDate: new Date(`${today}T09:15:59+05:30`),
        endDate: new Date(`${today}T15:30:00+05:30`),
        tz: "Asia/Kolkata",
      },
      {
        name: "updateSL",
        data: { user },
      }
    )

    return true
  } catch (e) {
    logger.error("[queue] addToChaseQueue error", e)
    throw e
  }
}

/** Re-arm today's Chase schedules from the stored access token. Safe to call on every boot and login. */
export async function restoreChaseSchedulers() {
  const { getLatestAccessToken } = await import("./drizzleDbUtils")
  const token = await getLatestAccessToken()
  if (!token) {
    logger.info("[queue] no access token for today — Chase schedules left unchanged")
    return false
  }
  await addToChaseQueue({ session: { access_token: token } })
  return true
}
