import { sendApiError } from "../../lib/apiErrors"
import {
  completedDailyBars,
  dailyTrendRowSignal,
  emaFromCloses,
  normalizeDailyTrendConfig,
  parseDailyTrendBulkPatch,
} from "../../lib/dailyTrend/engine"
import { loadNifty100 } from "../../lib/dailyTrend/nifty100"
import logger from "../../lib/logger"
import { istDate } from "../../lib/momentum/calendar"
import { cashPullProgress, progressForPage, startCashHistoryPull } from "../../lib/momentum/history"
import {
  acceptConstituentChange,
  dismissConstituentChange,
  listPendingConstituents,
  refreshIndexMembership,
  settlePendingConstituents,
} from "../../lib/momentum/membershipRefresh"
import {
  applyDailyTrendBulkToBooks,
  type DailyTrendBookRow,
  ensureNifty100Books,
  getDailyTrendState,
  listDailyTrendBooks,
  listLatestCloses,
  listMarketCaps,
  listTailCloses,
  removeDailyTrendBook,
  saveDailyTrendBook,
  saveDailyTrendRuntime,
  setAllDailyTrendEnabled,
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
    budgetInr: body.budgetInr == null ? (previous?.budgetInr ?? 0) : Number(body.budgetInr),
    stop: body.stop == null ? (previous?.stop ?? null) : Number(body.stop),
    entry: body.entry == null ? (previous?.entry ?? null) : Number(body.entry),
  }
}

export default withSession(async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized")
  try {
    if (req.method === "GET") {
      await ensureNifty100Books()
      const [state, books, caps] = await Promise.all([
        getDailyTrendState(),
        listDailyTrendBooks(),
        listMarketCaps(),
      ])
      const symbols = books.map(book => book.symbol)
      const closes = await listLatestCloses(symbols)
      const tails = await listTailCloses(symbols, 420)
      const today = istDate(new Date())
      const profile = new Map(caps.map(row => [row.symbol, row]))
      const seeded = new Map(loadNifty100().map(row => [row.symbol, row]))
      return res.json({
        ...state,
        pull: progressForPage("trend", cashPullProgress()),
        constituents: await listPendingConstituents("NIFTY100"),
        books: books.map(book => {
          const known = profile.get(book.symbol)
          const listed = seeded.get(book.symbol)
          const close = closes.get(book.symbol)
          const completed = completedDailyBars(tails.get(book.symbol) ?? [], today)
          const ema = emaFromCloses(
            completed.map(row => row.close),
            book.emaPeriod
          )
          const signalClose = completed.at(-1)?.close ?? null
          const signal = dailyTrendRowSignal({
            close: signalClose,
            ema,
            bufferPercent: book.bufferPercent,
            budgetInr: book.budgetInr,
            entryStyle: book.entryStyle,
          })
          return {
            ...book,
            name:
              known?.name && known.name !== book.symbol
                ? known.name
                : (listed?.name ?? book.symbol),
            industry: known?.industry || listed?.industry || "",
            marketCapCr: known?.marketCapCr ?? listed?.marketCapCr ?? null,
            marketCapAsOf: known?.asOf ?? null,
            close: signalClose,
            closeDate: completed.at(-1)?.date ?? null,
            storedClose: close?.date && close.date !== completed.at(-1)?.date ? close.close : null,
            storedDate: close?.date && close.date !== completed.at(-1)?.date ? close.date : null,
            ema,
            signal: signal.label,
            signalBuy: signal.buy,
            signalQualifies: signal.qualifies,
          }
        }),
      })
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
    if (req.method === "POST" && req.body?.action === "apply-all") {
      const parsed = parseDailyTrendBulkPatch(req.body)
      if (!parsed.ok) return res.status(400).json({ error: parsed.error })
      const count = await applyDailyTrendBulkToBooks(parsed.patch)
      return res.json({ count, books: await listDailyTrendBooks() })
    }
    if (req.method === "POST" && req.body?.action === "set-enabled-all") {
      const enabled = req.body.enabled === true
      const count = await setAllDailyTrendEnabled(enabled)
      return res.json({ count, enabled, books: await listDailyTrendBooks() })
    }
    if (req.method === "POST" && req.body?.action === "remove-book") {
      await removeDailyTrendBook(String(req.body.symbol || ""))
      return res.json({ books: await listDailyTrendBooks() })
    }
    if (req.method === "POST" && req.body?.action === "pull") {
      const state = await getDailyTrendState()
      if (!state.config.active)
        return res.status(409).json({ error: "Turn Engine on before pulling history" })
      return res.json(
        startCashHistoryPull({
          accessToken: req.session.user.session?.access_token,
          force: true,
          scope: "trend",
          onlyMissing: req.body?.onlyMissing === true,
        })
      )
    }
    if (req.method === "POST" && req.body?.action === "refresh-constituents") {
      const result = await refreshIndexMembership("NIFTY100", { force: true })
      return res.json({
        ...result,
        constituents: await listPendingConstituents("NIFTY100"),
        books: await listDailyTrendBooks(),
        message: result.kept
          ? "The index site did not return a file. The stored list was left as it is."
          : undefined,
      })
    }
    if (req.method === "POST" && req.body?.action === "accept-constituent") {
      await acceptConstituentChange(Number(req.body.id))
      return res.json({
        constituents: await listPendingConstituents("NIFTY100"),
        books: await listDailyTrendBooks(),
      })
    }
    if (req.method === "POST" && req.body?.action === "dismiss-constituent") {
      await dismissConstituentChange(Number(req.body.id))
      return res.json({ constituents: await listPendingConstituents("NIFTY100") })
    }
    if (
      req.method === "POST" &&
      (req.body?.action === "accept-constituents" || req.body?.action === "dismiss-constituents")
    ) {
      const side = req.body.side === "REMOVE" ? "REMOVE" : "ADD"
      await settlePendingConstituents(
        "NIFTY100",
        side,
        req.body.action === "accept-constituents" ? "ACCEPTED" : "DISMISSED"
      )
      return res.json({
        constituents: await listPendingConstituents("NIFTY100"),
        books: await listDailyTrendBooks(),
      })
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
