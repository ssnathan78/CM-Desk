import { sendApiError } from "../../lib/apiErrors"
import {
  addChaseUnderlying,
  getChaseSettings,
  listChaseBooks,
  removeChaseUnderlying,
  resetChaseBooks,
  saveChaseSettings,
} from "../../lib/chaseSettings"
import { futuresUnderlyingNames, normalizeChaseUnderlying } from "../../lib/chaseUniverse"
import { validateChaseSettings } from "../../lib/chaseValidation"
import logger from "../../lib/logger"
import withSession from "../../lib/session"

async function chaseBookLotSizes(names: string[]): Promise<Record<string, number>> {
  if (!names.length) return {}
  try {
    const { getIndexInstruments } = await import("../../lib/kiteUtils")
    const { fromKiteInstrument, futuresLotSizes } = await import("../../lib/trading/instrumentBook")
    const rows = (await getIndexInstruments())
      .map(row => fromKiteInstrument(row))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    return futuresLotSizes(rows, names)
  } catch (e) {
    logger.warn("[chase-settings] lot size preview unavailable", e)
    return {}
  }
}

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) {
    return res.status(401).send("Unauthorized")
  }

  try {
    if (req.method === "GET") {
      const [config, books] = await Promise.all([getChaseSettings(), listChaseBooks()])
      const lotSizes = await chaseBookLotSizes(books.map(book => book.instrument))
      try {
        const { buildDeskSetupNotional } = await import("../../lib/trading/setupNotional")
        const setups = await buildDeskSetupNotional()
        return res.json({
          config,
          books,
          notional: {
            maxNotionalInr: setups.maxNotionalInr,
            rows: setups.rows.filter(row => row.source === "CHASE"),
            lotSizes,
          },
        })
      } catch (e) {
        logger.warn("[chase-settings] notional preview unavailable", e)
        return res.json({ config, books, notional: { maxNotionalInr: 0, rows: [], lotSizes } })
      }
    }

    if (req.method === "PUT") {
      const patch = {
        ...(req.body?.config || {}),
        instrument: req.body?.instrument || req.body?.config?.instrument,
      }
      const { getMaxLotsForStrategy } = await import("../../lib/trading/riskSettings")
      const validation = validateChaseSettings(patch, {
        maxLots: await getMaxLotsForStrategy("CHASE"),
      })
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error })
      }
      const config = await saveChaseSettings(patch)
      const books = await listChaseBooks()
      return res.json({ config, books })
    }

    if (req.method === "POST" && req.body?.action === "add-underlying") {
      const name = normalizeChaseUnderlying(req.body?.instrument)
      if (!name) return res.status(400).json({ error: "Enter a Kite NFO underlying" })
      const { getIndexInstruments } = await import("../../lib/kiteUtils")
      const listed = futuresUnderlyingNames(
        (await getIndexInstruments()).map(row => ({
          name: row.name,
          instrument_type: row.instrument_type,
          expiry: row.expiry,
        }))
      )
      if (!listed.includes(name)) {
        return res.status(400).json({ error: `${name} has no unexpired NFO future` })
      }
      const book = await addChaseUnderlying(name)
      const [config, books] = await Promise.all([getChaseSettings(), listChaseBooks()])
      return res.json({ config, books, book })
    }

    if (req.method === "POST" && req.body?.action === "remove-underlying") {
      const name = normalizeChaseUnderlying(req.body?.instrument)
      if (!name) return res.status(400).json({ error: "Enter a Kite NFO underlying" })
      const { getChaseStatus } = await import("../../lib/drizzleDbUtils")
      const { resolveChaseBookBreakdown } = await import("../../lib/chaseSignal")
      const row = await getChaseStatus(name)
      let netQty = 0
      if (row?.tradingsymbol) {
        try {
          const book = await resolveChaseBookBreakdown(
            row.tradingsymbol,
            user.session?.access_token || ""
          )
          netQty = book.netQty
        } catch (e) {
          logger.warn("[chase-settings] remove refused; quantity unknown", e)
          return res.status(409).json({
            error: "Could not prove this book is flat, so it was not removed",
          })
        }
      }
      const removed = await removeChaseUnderlying(name, row?.status ?? null, netQty)
      if (!removed.ok) return res.status(409).json({ error: removed.error })
      const [config, books] = await Promise.all([getChaseSettings(), listChaseBooks()])
      return res.json({ config, books })
    }

    if (req.method === "POST" && req.body?.action === "reset") {
      const config = await resetChaseBooks()
      const books = await listChaseBooks()
      return res.json({ config, books })
    }

    if (req.method === "POST" && req.body?.action === "reset-signal") {
      const { resetAllChaseSignalState, resetChaseSignalState } = await import(
        "../../lib/chaseReset"
      )
      const instrument =
        typeof req.body?.instrument === "string" && req.body.instrument.trim()
          ? req.body.instrument.trim().toUpperCase()
          : null
      const result = instrument
        ? await resetChaseSignalState({
            instrument,
            accessToken: user.session?.access_token,
            force: Boolean(req.body?.force),
          })
        : await resetAllChaseSignalState({
            accessToken: user.session?.access_token,
            force: Boolean(req.body?.force),
          })
      if (!result.ok) {
        return res.status(409).json(result)
      }
      const [config, books] = await Promise.all([getChaseSettings(), listChaseBooks()])
      return res.json({ config, books, reset: result })
    }

    return res.status(405).json({ error: "Method not allowed" })
  } catch (e) {
    return sendApiError(res, e, logger, "chase-settings")
  }
})
