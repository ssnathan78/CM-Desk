import dayjs, { type ConfigType } from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { EXPIRY_TYPE, INSTRUMENT_DETAILS, type INSTRUMENTS } from "./constants"

dayjs.extend(utc)
dayjs.extend(timezone)

/** Calendar day in Asia/Kolkata. A Zulu midnight must not become the previous evening. */
export function expiryCalendarDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = dayjs(value)
  if (!parsed.isValid()) return "Invalid Date"
  return parsed.tz("Asia/Kolkata").format("YYYY-MM-DD")
}

export function expiryRuleLabel(instrument: string | undefined, expiryType: string): string {
  const weekly = Boolean(
    instrument && INSTRUMENT_DETAILS[instrument as INSTRUMENTS]?.hasWeeklyExpiry
  )
  if (weekly) {
    if (expiryType === EXPIRY_TYPE.NEXT) return "Next week expiry"
    if (expiryType === EXPIRY_TYPE.MONTHLY) return "Monthly expiry"
    return "Current week expiry"
  }
  if (expiryType === EXPIRY_TYPE.NEXT) return "Next month expiry"
  return "Current month expiry"
}

/** Nearest distinct expiry dates, already sorted ascending as YYYY-MM-DD. */
export function pickExpiryDate(
  dates: string[],
  hasWeekly: boolean,
  expiryType: string
): string | null {
  const unique = [...new Set(dates.map(value => expiryCalendarDay(value)))]
    .filter(value => value !== "Invalid Date")
    .sort()
  if (!unique.length) return null
  if (expiryType === EXPIRY_TYPE.NEXT) return unique[1] ?? null
  if (hasWeekly && expiryType === EXPIRY_TYPE.MONTHLY) {
    const first = dayjs(unique[0])
    const inMonth = unique.filter(value => dayjs(value).isSame(first, "month"))
    return inMonth[inMonth.length - 1] ?? unique[0]
  }
  return unique[0]
}

export function daysUntilExpiry(date: string, now: ConfigType = dayjs()): number {
  return dayjs(date).startOf("day").diff(dayjs(now).startOf("day"), "day")
}

export function formatExpiryPreview(date: string, now: ConfigType = dayjs()): string {
  const days = daysUntilExpiry(date, now)
  const when = dayjs(date).format("D MMM")
  if (days === 0) return `${when} · expires today`
  if (days === 1) return `${when} · 1 day`
  return `${when} · ${days} days`
}
