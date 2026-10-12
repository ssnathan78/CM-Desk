import { sendApiError } from "../../lib/apiErrors"
import { listChaseBooks } from "../../lib/chaseSettings"
import { futuresUnderlyingNames, searchFuturesUnderlyings } from "../../lib/chaseUniverse"
import logger from "../../lib/logger"
import withSession from "../../lib/session"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
  try {
    const query = typeof req.query.q === "string" ? req.query.q : ""
    const { getIndexInstruments } = await import("../../lib/kiteUtils")
    const listed = futuresUnderlyingNames(
      (await getIndexInstruments()).map(row => ({
        name: row.name,
        instrument_type: row.instrument_type,
        expiry: row.expiry,
      }))
    )
    const taken = new Set((await listChaseBooks()).map(book => book.instrument))
    const names = searchFuturesUnderlyings(listed, query).filter(name => !taken.has(name))
    return res.json({ names })
  } catch (e) {
    return sendApiError(res, e, logger, "chase-underlyings")
  }
})
