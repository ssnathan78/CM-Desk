import { sendApiError } from "../../../lib/apiErrors"
import { buildChaseSparkSeries } from "../../../lib/chase/chartSeries"
import { listChaseBooks } from "../../../lib/chaseSettings"
import { normalizeChaseUnderlying } from "../../../lib/chaseUniverse"
import { nowDayjs } from "../../../lib/clock"
import { getChaseStatus } from "../../../lib/drizzleDbUtils"
import { getIndexInstruments, getKiteInstance } from "../../../lib/kiteUtils"
import logger from "../../../lib/logger"
import withSession from "../../../lib/session"
import { fromKiteInstrument } from "../../../lib/trading/instrumentBook"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).send("Unauthorized")
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  const instrument = normalizeChaseUnderlying(String(req.query.instrument || ""))
  if (!instrument) return res.status(400).json({ error: "instrument is required" })

  try {
    const books = await listChaseBooks()
    const book = books.find(row => row.instrument === instrument)
    if (!book) return res.status(404).json({ error: "Unknown Chase book" })

    const status = await getChaseStatus(instrument)
    const tradingsymbol = status?.tradingsymbol
    if (!tradingsymbol) {
      return res.status(409).json({ error: "No active futures symbol for this book yet" })
    }

    const instruments = (await getIndexInstruments())
      .map(row => fromKiteInstrument(row))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    const match = instruments.find(row => row.tradingsymbol === tradingsymbol)
    if (!match?.instrumentToken) {
      return res.status(404).json({ error: "Instrument token not found" })
    }

    const token = Number(match.instrumentToken)
    const accessToken = user.session?.access_token
    if (!accessToken) return res.status(401).json({ error: "Missing Kite session" })

    const kite = getKiteInstance(accessToken)
    const end = nowDayjs()
    const start = end.subtract(Math.max(50, book.emaPeriod + 24), "day").toDate()
    const candles = await kite.getHistoricalData(token, "60minute", start, end.toDate())
    if (!Array.isArray(candles) || candles.length === 0) {
      return res.status(502).json({ error: "No hourly candles returned" })
    }

    const tail = candles.slice(-48)
    const bars = tail.map(c => ({
      close: Math.round(c.close),
      high: Math.round(c.high),
      low: Math.round(c.low),
    }))
    const series = buildChaseSparkSeries(bars, book.emaPeriod, book.bufferPercent)

    return res.json({
      instrument,
      tradingsymbol,
      emaPeriod: book.emaPeriod,
      bufferPercent: book.bufferPercent,
      points: tail.map((candle, index) => ({
        at: candle.date.toISOString(),
        close: bars[index].close,
        ema: series.ema[index] == null ? null : Math.round(series.ema[index]!),
        upper: series.upper[index] == null ? null : Math.round(series.upper[index]!),
        lower: series.lower[index] == null ? null : Math.round(series.lower[index]!),
      })),
      scale: series.scale,
    })
  } catch (error) {
    return sendApiError(res, error, logger, "chase-settings/chart")
  }
})
