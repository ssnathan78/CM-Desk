import { sendApiError } from "../../../lib/apiErrors"
import logger from "../../../lib/logger"
import withSession from "../../../lib/session"
import { computePortfolio, listDailySessions } from "../../../lib/trading/portfolio"
import { parseTradeBook } from "../../../lib/trading/types"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
  try {
    const book = parseTradeBook(req.query.book)
    const from = typeof req.query.from === "string" ? req.query.from : undefined
    const to = typeof req.query.to === "string" ? req.query.to : undefined
    const [portfolio, sessions] = await Promise.all([
      computePortfolio(undefined, book),
      listDailySessions({ limit: 400, from, to }),
    ])
    return res.json({ portfolio, sessions, book })
  } catch (e) {
    return sendApiError(res, e, logger, "desk/portfolio")
  }
})
