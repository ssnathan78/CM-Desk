import { sendApiError } from "../../lib/apiErrors"
import logger from "../../lib/logger"
import { listDailyTrendBooks } from "../../lib/momentum/store"
import { searchListedNseCash } from "../../lib/nseCashSymbol"
import withSession from "../../lib/session"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
  try {
    const query = typeof req.query.q === "string" ? req.query.q : ""
    const taken = new Set((await listDailyTrendBooks()).map(book => book.symbol))
    const matches = (await searchListedNseCash(query, user.session?.access_token)).filter(
      row => !taken.has(row.symbol)
    )
    return res.json({ matches })
  } catch (error) {
    return sendApiError(res, error, logger, "nse-cash-search")
  }
})
