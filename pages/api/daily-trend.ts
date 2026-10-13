import { sendApiError } from "../../lib/apiErrors"
import { normalizeDailyTrendConfig } from "../../lib/dailyTrend/engine"
import logger from "../../lib/logger"
import { pullCashHistory } from "../../lib/momentum/history"
import {
  type DailyTrendBookRow,
  getDailyTrendState,
  listDailyTrendBooks,
  removeDailyTrendBook,
  saveDailyTrendBook,
  saveDailyTrendRuntime,
} from "../../lib/momentum/store"
import { evaluateDailyTrend } from "../../lib/momentum/trendRun"
import { requireListedNseCash } from "../../lib/nseCashSymbol"
import withSession from "../../lib/session"

function bookFromBody(
  body: Record<string, unknown>,
  previous?: DailyTrendBookRow
): DailyTrendBookRow {
  const config = normalizeDailyTrendConfig(body)
  const symbol = String(body.symbol || previous?.symbol || "").toUpperCase()
  const status =
    body.status === "PENDING_LONG" || body.status === "LONG"
      ? body.status
      : previous?.status || "FLAT"
  return {
    symbol,
    enabled: body.enabled == null ? (previous?.enabled ?? false) : body.enabled === true,
    paused: body.paused == null ? (previous?.paused ?? false) : body.paused === true,
    emaPeriod: config.emaPeriod,
    bufferPercent: config.bufferPercent,
    exitBufferPercent: config.exitBufferPercent,
    quantity: config.quantity,
    entryStyle: config.entryStyle,
    status,
    stop: body.stop == null ? (previous?.stop ?? null) : Number(body.stop),
    entry: body.entry == null ? (previous?.entry ?? null) : Number(body.entry),
  }
}

export default withSession(async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized")
  try {
    if (req.method === "GET") {
      const [state, books] = await Promise.all([getDailyTrendState(), listDailyTrendBooks()])
      return res.json({ ...state, books })
    }
    if (req.method === "PUT") {
      const state = await saveDailyTrendRuntime(req.body?.config ?? req.body)
      return res.json({ ...state, books: await listDailyTrendBooks() })
    }
    if (req.method === "POST" && req.body?.action === "save-book") {
      const listed = await requireListedNseCash(
        String(req.body.symbol || ""),
        req.session.user.session?.access_token
      )
      if (!listed.ok) return res.status(400).json({ error: listed.error })
      const symbol = listed.symbol
      const existing = (await listDailyTrendBooks()).find(book => book.symbol === symbol)
      await saveDailyTrendBook(bookFromBody({ ...req.body, symbol }, existing))
      return res.json({ books: await listDailyTrendBooks() })
    }
    if (req.method === "POST" && req.body?.action === "remove-book") {
      await removeDailyTrendBook(String(req.body.symbol || ""))
      return res.json({ books: await listDailyTrendBooks() })
    }
    if (req.method === "POST" && req.body?.action === "pull") {
      const state = await getDailyTrendState()
      if (!state.config.active)
        return res.status(409).json({ error: "Turn the strategy on before pulling history" })
      return res.json(
        await pullCashHistory({ accessToken: req.session.user.session?.access_token, force: true })
      )
    }
    if (req.method === "POST" && req.body?.action === "evaluate") {
      const result = await evaluateDailyTrend({
        execute: req.body.execute === true,
        accessToken: req.session.user.session?.access_token,
      })
      return res.json({ ...result, books: await listDailyTrendBooks() })
    }
    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    return sendApiError(res, error, logger, "daily-trend")
  }
})
