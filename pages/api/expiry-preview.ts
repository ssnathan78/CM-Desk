import dayjs from "dayjs"
import type { NextApiRequest, NextApiResponse } from "next"
import { INSTRUMENT_DETAILS, type INSTRUMENTS } from "../../lib/constants"
import { expiryCalendarDay, formatExpiryPreview, pickExpiryDate } from "../../lib/expiryRule"
import logger from "../../lib/logger"
import withSession from "../../lib/session"

export default withSession(async (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.session.user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).end()
  const instrument = String(req.query.instrument || "")
  const details = INSTRUMENT_DETAILS[instrument as INSTRUMENTS]
  if (!details) return res.status(400).json({ error: "Unknown instrument" })
  try {
    const { getIndexInstruments } = await import("../../lib/kiteUtils")
    const rows = (await getIndexInstruments()) as {
      name?: string
      instrument_type?: string
      expiry?: string
    }[]
    const today = dayjs().tz("Asia/Kolkata").startOf("day")
    const dates = rows
      .filter(row => row.name === details.nfoSymbol && row.instrument_type === "CE" && row.expiry)
      .map(row => String(row.expiry))
      .filter(value => {
        const day = expiryCalendarDay(value)
        return day !== "Invalid Date" && !dayjs(day).isBefore(today, "day")
      })
    const current = pickExpiryDate(dates, details.hasWeeklyExpiry, "CURRENT")
    const next = pickExpiryDate(dates, details.hasWeeklyExpiry, "NEXT")
    const monthly = details.hasWeeklyExpiry ? pickExpiryDate(dates, true, "MONTHLY") : current
    const preview = (date: string | null) => (date ? formatExpiryPreview(date) : null)
    return res.json({
      CURRENT: preview(current),
      NEXT: preview(next),
      MONTHLY: preview(monthly),
    })
  } catch {
    logger.warn("[expiry-preview] contract dates unavailable")
    return res.json({ CURRENT: null, NEXT: null, MONTHLY: null })
  }
})
