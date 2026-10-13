import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

import { IST_TZ, isNonTradingDay } from "../marketCalendar"

dayjs.extend(utc)
dayjs.extend(timezone)

/** True when `now` is the first NSE session of its calendar month. */
export function firstTradingSessionOfMonth(now: Date): boolean {
  const ist = dayjs(now).tz(IST_TZ)
  if (isNonTradingDay(ist)) return false
  const start = ist.startOf("month")
  for (let day = start; day.isBefore(ist, "day"); day = day.add(1, "day")) {
    if (!isNonTradingDay(day)) return false
  }
  return true
}

export function isoWeekdayIst(now: Date): number {
  const day = dayjs(now).tz(IST_TZ).day()
  return day === 0 ? 7 : day
}

export function istDate(now: Date): string {
  return dayjs(now).tz(IST_TZ).format("YYYY-MM-DD")
}
