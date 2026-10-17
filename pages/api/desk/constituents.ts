import { sendApiError } from "../../../lib/apiErrors"
import logger from "../../../lib/logger"
import { buildConstituentImpactPreview } from "../../../lib/momentum/constituentPreview"
import {
  acceptConstituentChange,
  dismissConstituentChange,
  listMomentumConstituents,
  listPendingConstituents,
  refreshIndexMembership,
  settlePendingConstituents,
} from "../../../lib/momentum/membershipRefresh"
import { listDailyTrendBooks } from "../../../lib/momentum/store"
import withSession from "../../../lib/session"

export default withSession(async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized")
  const book = req.body?.book === "trend" ? "trend" : "momentum"
  const indexCode = book === "trend" ? "NIFTY100" : "NIFTY_TOTAL_MARKET"
  try {
    if (req.method === "GET") {
      return res.json({
        momentum: await listMomentumConstituents(),
        trend: await listPendingConstituents("NIFTY100"),
      })
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
    const action = String(req.body?.action || "")
    if (action === "preview") {
      const side = req.body.side === "REMOVE" ? "REMOVE" : "ADD"
      if (book === "trend") {
        const trend = (await listPendingConstituents("NIFTY100")).filter(row => row.action === side)
        const books = await listDailyTrendBooks()
        const preview = buildConstituentImpactPreview(
          trend.map(row => ({ action: row.action, symbol: row.symbol })),
          books.map(b => b.symbol)
        )
        return res.json({ preview, count: trend.length, side, book })
      }
      const momentum = (await listMomentumConstituents()).filter(row => row.action === side)
      return res.json({
        preview: {
          momentum: {
            symbols: momentum.map(row => row.symbol),
            side,
          },
        },
        count: momentum.length,
        side,
        book,
      })
    }
    if (action === "refresh") {
      const result = await refreshIndexMembership(indexCode, { force: true })
      return res.json({
        ...result,
        momentum: await listMomentumConstituents(),
        trend: await listPendingConstituents("NIFTY100"),
        books: book === "trend" ? await listDailyTrendBooks() : undefined,
        message: result.kept
          ? "The index site did not return a file. The stored list was left as it is. See Alerts."
          : undefined,
      })
    }
    if (action === "accept") {
      await acceptConstituentChange(Number(req.body.id))
    } else if (action === "dismiss") {
      await dismissConstituentChange(Number(req.body.id))
    } else if (action === "accept-all" || action === "dismiss-all") {
      const side = req.body.side === "REMOVE" ? "REMOVE" : "ADD"
      await settlePendingConstituents(
        indexCode,
        side,
        action === "accept-all" ? "ACCEPTED" : "DISMISSED"
      )
    } else {
      return res.status(400).json({ error: "Unknown constituent action" })
    }
    return res.json({
      momentum: await listMomentumConstituents(),
      trend: await listPendingConstituents("NIFTY100"),
      books: book === "trend" ? await listDailyTrendBooks() : undefined,
    })
  } catch (error) {
    return sendApiError(res, error, logger, "desk constituents")
  }
})
