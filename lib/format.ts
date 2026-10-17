import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

import { IST_TZ } from "./marketCalendar"

dayjs.extend(utc)
dayjs.extend(timezone)

const MINUS = "\u2212"
const EM_DASH = "\u2014"

function parseNum(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function formatSignedNumber(n: number, dp: number, sign?: boolean): string {
  const abs = Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })
  if (n < 0) return `${MINUS}${abs}`
  if (sign && n > 0) return `+${abs}`
  return abs
}

export function formatInr(
  value: string | number | null | undefined,
  opts: { sign?: boolean } = {}
): string {
  const n = parseNum(value)
  if (n == null) return EM_DASH
  return formatSignedNumber(n, 2, opts.sign)
}

export function formatInrLabel(
  value: string | number | null | undefined,
  opts: { sign?: boolean } = {}
): string {
  const core = formatInr(value, opts)
  if (core === EM_DASH) return core
  return `\u20B9${core}`
}

export function formatPts(value: string | number | null | undefined, opts: { sign?: boolean } = {}) {
  const n = parseNum(value)
  if (n == null) return EM_DASH
  return formatSignedNumber(n, 2, opts.sign)
}

export function formatPtsLabel(
  value: string | number | null | undefined,
  opts: { sign?: boolean } = {}
): string {
  const core = formatPts(value, opts)
  if (core === EM_DASH) return core
  return `${core} pts`
}

export function formatQty(
  value: string | number | null | undefined,
  opts: { signed?: boolean } = {}
): string {
  const n = parseNum(value)
  if (n == null) return EM_DASH
  const rounded = Math.trunc(n)
  const grouped = Math.abs(rounded).toLocaleString("en-IN")
  if (opts.signed && rounded < 0) return `${MINUS}${grouped}`
  if (opts.signed && rounded > 0) return `+${grouped}`
  return grouped
}

export function formatPrice(
  value: string | number | null | undefined,
  opts: { flat?: boolean } = {}
): string {
  const n = parseNum(value)
  if (n == null) return EM_DASH
  if (opts.flat && n === 0) return EM_DASH
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPct(fraction: string | number | null | undefined, dp = 1): string {
  const n = parseNum(fraction)
  if (n == null) return EM_DASH
  return `${(n * 100).toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}%`
}

export function formatPctValue(value: string | number | null | undefined, dp = 2): string {
  const n = parseNum(value)
  if (n == null) return EM_DASH
  return `${n.toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}%`
}

function toIst(d: string | Date | number | dayjs.Dayjs) {
  return dayjs(d).tz(IST_TZ)
}

export function formatIstTime(d: string | Date | null | undefined): string {
  if (!d) return EM_DASH
  return toIst(d).format("HH:mm:ss")
}

export function formatIstDateTimeTitle(d: string | Date | null | undefined): string {
  if (!d) return EM_DASH
  return `${toIst(d).format("D MMM YYYY, HH:mm:ss")} IST`
}

export function formatIstDateTime(d: string | Date | null | undefined): string {
  if (!d) return EM_DASH
  const ist = toIst(d)
  const now = dayjs().tz(IST_TZ)
  if (ist.isSame(now, "day")) return ist.format("HH:mm:ss")
  if (ist.isSame(now, "year")) return ist.format("D MMM HH:mm")
  return ist.format("D MMM YYYY HH:mm")
}

export function formatIstDate(d: string | Date | null | undefined): string {
  if (!d) return EM_DASH
  return toIst(d).format("D MMM YYYY")
}

export function formatClockHHmm(d: string | Date | null | undefined): string {
  if (!d) return EM_DASH
  return toIst(d).format("HH:mm")
}

export type PnlTone = "profit" | "loss" | "zero" | "none"

export function pnlTone(value: string | number | null | undefined): PnlTone {
  const n = parseNum(value)
  if (n == null) return "none"
  if (n === 0) return "zero"
  return n > 0 ? "profit" : "loss"
}

export function pnlColorSx(tone: PnlTone): string {
  if (tone === "profit") return "success.main"
  if (tone === "loss") return "error.main"
  return "text.secondary"
}
