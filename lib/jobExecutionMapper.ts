import { collectPlanExtras } from "./planMapper"
import type { jobExecutions } from "./schema"

/** Columns accepted on job_executions insert (excludes server-controlled fields). */
const JOB_EXECUTION_INSERT_COLUMNS = new Set([
  "name",
  "instrument",
  "strategy",
  "exitStrategy",
  "combinedExitStrategy",
  "expiryType",
  "productType",
  "volatilityType",
  "slOrderType",
  "lots",
  "slmPercent",
  "slLimitPricePercent",
  "maxProfitPoints",
  "maxLossPoints",
  "trailingSlPercent",
  "trailingMaxProfitPoints",
  "trailingMaxLossPoints",
  "trailingProfitPercent",
  "trailEveryPctChangeValue",
  "trailEveryPercentageChangeValue",
  "thresholdSkewPercent",
  "maxSkewPercent",
  "expireIfUnsuccessfulInMins",
  "isMaxProfitEnabled",
  "isMaxLossEnabled",
  "isAutoSquareOffEnabled",
  "takeTradeIrrespectiveSkew",
  "onSquareOffSetAborted",
  "runNow",
  "squareOffTime",
  "expiresAt",
  "runAt",
  "autoSquareOffTime",
  "autoSquareOffProps",
  "autoSquareOffDeletePendingOrders",
  "dayOfWeek",
  "planRef",
  "templateId",
])

const TIMESTAMP_COLUMNS = new Set(["squareOffTime", "expiresAt", "runAt", "autoSquareOffTime"])

/** Strangle / hedge fields passed to queue workers but not stored as DB columns. */
const QUEUE_ONLY_FIELDS = [
  "entryStrategy",
  "distanceFromAtm",
  "percentfromAtm",
  "optionPrice",
  "orderType",
  "isHedgeEnabled",
  "hedgeDistance",
  "inverted",
  "onBrokenHedgeOrders",
  "onBrokenPrimaryOrders",
  "onBrokenExitOrders",
] as const

const toDate = (value: unknown) => {
  if (!value) return value
  if (value instanceof Date) return value
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? value : d
}

export function mapJobExecutionInsert(body: Record<string, unknown> = {}): Record<string, unknown> {
  const mapped = Object.entries(body).reduce<Record<string, unknown>>((accum, [key, value]) => {
    if (value === undefined || value === null || key === "id" || key === "orderTag") {
      return accum
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return accum
    }
    if (JOB_EXECUTION_INSERT_COLUMNS.has(key)) {
      accum[key] = TIMESTAMP_COLUMNS.has(key) ? toDate(value) : value
    }
    return accum
  }, {})

  return mapped
}

/** Identity of a queued job. A later edit or a nested extras object cannot replace these. */
export const FROZEN_PENDING_JOB_FIELDS = [
  "strategy",
  "lots",
  "productType",
  "instrument",
  "volatilityType",
] as const

export function pendingJobFieldChange(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): string | null {
  for (const key of FROZEN_PENDING_JOB_FIELDS) {
    if (!(key in patch) || patch[key] === undefined || patch[key] === null) continue
    if (String(patch[key]) !== String(current[key] ?? "")) {
      return `${key} is fixed on a queued job. Create a new job to change it.`
    }
  }
  return null
}

export function omitFrozenPendingJobFields(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body }
  for (const key of FROZEN_PENDING_JOB_FIELDS) delete next[key]
  return next
}

/** Worker payload. Stored lots, strategy, product, instrument, and direction win over the request. */
export function mapJobExecutionQueuePayload(
  body: Record<string, unknown>,
  dbRow: Record<string, unknown>,
  orderTag: string
): Record<string, unknown> {
  const extras = collectPlanExtras(body)
  const queueOnly = Object.fromEntries(
    QUEUE_ONLY_FIELDS.map(key => [key, body[key]]).filter(([, v]) => v !== undefined && v !== null)
  )

  return {
    ...dbRow,
    ...queueOnly,
    ...extras,
    orderTag,
    lots: dbRow.lots,
    strategy: dbRow.strategy,
    productType: dbRow.productType,
    instrument: dbRow.instrument,
    volatilityType: dbRow.volatilityType,
  }
}

export type JobExecutionInsert = typeof jobExecutions.$inferInsert
