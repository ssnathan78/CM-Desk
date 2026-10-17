/** Statuses that mean this template already has a live or finished run today. */
const BLOCKING = new Set(["PENDING", "QUEUE", "EXECUTING", "COMPLETED", "SQUARED_OFF"])

/** A rejected or failed run must show on the due list so the operator can send it again. */
export function templateBlockedByJob(status: string | null | undefined): boolean {
  return BLOCKING.has(String(status || ""))
}

/** A Pending row with no queue id, older than this, never reached Redis. */
export const STUCK_JOB_MS = 2 * 60 * 1000

/**
 * Chase rows are restored from the repeating schedule, not from one queue id.
 * A Pending/Queue row with no Redis job is failed so the due list can show the template again.
 * `queueJobMissing` is the Redis lookup: true when the stored id is gone.
 */
export function jobNeedsReconcile(input: {
  status: string | null
  ageMs: number
  hasQueueId: boolean
  queueType?: string | null
  queueJobMissing?: boolean
}): "fail" | "keep" {
  if (input.queueType === "chase") return "keep"
  if (input.status !== "PENDING" && input.status !== "QUEUE") return "keep"
  if (input.ageMs < STUCK_JOB_MS) return "keep"
  if (!input.hasQueueId) return "fail"
  if (input.queueJobMissing) return "fail"
  return "keep"
}
