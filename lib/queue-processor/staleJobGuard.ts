import dayjs, { type Dayjs } from "dayjs"

/** True when a BullMQ job was scheduled for a previous calendar day (IST). */
export function isStaleTradingJob(scheduledAtMs: number, delayMs = 0, now: Dayjs = dayjs()) {
  const scheduledAt = dayjs(scheduledAtMs + delayMs)
  return !scheduledAt.isSame(now, "day")
}

/**
 * A delayed entry that becomes active this long after its scheduled instant is discarded.
 * Explicit Run now has delay 0, so it is not late. Same-day square-off does not use this.
 */
export const LATE_ENTRY_GRACE_MS = 3 * 60 * 1000

export function isLateTradingJob(
  scheduledAtMs: number,
  delayMs = 0,
  now: Dayjs = dayjs(),
  graceMs = LATE_ENTRY_GRACE_MS
) {
  const dueAt = scheduledAtMs + delayMs
  return now.valueOf() - dueAt > graceMs
}
