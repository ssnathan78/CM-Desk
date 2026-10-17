import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { z } from "zod"

import { IST_TZ } from "../marketCalendar"

dayjs.extend(utc)
dayjs.extend(timezone)

const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/

export function tradeTimeToHhmm(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const m = timeRe.exec(trimmed)
  if (m) return trimmed
  const d = dayjs(trimmed).tz(IST_TZ)
  if (!d.isValid()) return null
  return d.format("HH:mm")
}

function parseIstTime(value: string) {
  const hhmm = tradeTimeToHhmm(value)
  if (!hhmm) return null
  const m = timeRe.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h * 60 + min
}

function inMarketMinutes(minutes: number) {
  const open = 9 * 60 + 15
  const close = 15 * 60 + 30
  return minutes >= open && minutes <= close
}

export const templateLotsSchema = z
  .union([z.string(), z.number()])
  .transform(v => (typeof v === "string" ? v.trim() : String(v)))
  .refine(v => v !== "", "Lots is required")
  .refine(v => /^\d+$/.test(v), "Lots must be a whole number ≥ 1")
  .transform(v => Number(v))
  .refine(n => n >= 1, "Lots must be a whole number ≥ 1")

export const templateTimeSchema = z
  .string()
  .trim()
  .refine(v => tradeTimeToHhmm(v) !== null, "Use HH:mm (24-hour IST)")
  .refine(v => {
    const m = parseIstTime(v)
    return m !== null && inMarketMinutes(m)
  }, "Outside market hours (09:15–15:30 IST)")

export function validateTemplateTimes(runAt: string, asoTime: string): string | null {
  const run = parseIstTime(runAt)
  const aso = parseIstTime(asoTime)
  if (run === null || !inMarketMinutes(run))
    return "Run time outside market hours (09:15–15:30 IST)"
  if (aso === null || !inMarketMinutes(aso))
    return "ASO time outside market hours (09:15–15:30 IST)"
  if (aso <= run) return "Auto square-off must be after run time"
  return null
}

export function validateTemplateLotsInput(value: unknown): string | null {
  const parsed = templateLotsSchema.safeParse(value)
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Invalid lots")
}
