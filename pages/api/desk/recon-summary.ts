import { and, desc, eq } from "drizzle-orm"

import { sendApiError } from "../../../lib/apiErrors"
import { db } from "../../../lib/drizzle"
import logger from "../../../lib/logger"
import { auditEvents, reconciliationEvents } from "../../../lib/schema"
import withSession from "../../../lib/session"
import { signedQty } from "../../../lib/trading/accounting"
import { listOperatorAlerts } from "../../../lib/trading/alerts"
import { DEFAULT_ACCOUNT_ID, getOpenPositions } from "../../../lib/trading/ledger"
import { buildReconSummary } from "../../../lib/trading/reconSummary"

export default withSession(async (req, res) => {
  const user = req.session.user
  if (!user) return res.status(401).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  try {
    const accountId = DEFAULT_ACCOUNT_ID
    const [unresolved, completedRow, openRows, alerts] = await Promise.all([
      db
        .select()
        .from(reconciliationEvents)
        .where(eq(reconciliationEvents.resolved, false))
        .orderBy(desc(reconciliationEvents.occurredAt))
        .limit(50),
      db
        .select({ occurredAt: auditEvents.occurredAt })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.accountId, accountId),
            eq(auditEvents.eventType, "RECONCILIATION_COMPLETED")
          )
        )
        .orderBy(desc(auditEvents.occurredAt))
        .limit(1),
      getOpenPositions(),
      listOperatorAlerts(40, "today"),
    ])

    let openLedger = 0
    for (const row of openRows) {
      if (signedQty(row.quantity) !== 0) openLedger += 1
    }

    const reconAlertCount = alerts.alerts.filter(a => a.source === "RECON").length

    const summary = buildReconSummary({
      unresolved: unresolved.map(r => ({
        id: r.id,
        kind: r.kind,
        severity: r.severity,
        tradingsymbol: r.tradingsymbol,
        detail: r.detail,
        occurredAt: r.occurredAt,
        resolved: r.resolved,
      })),
      lastCompletedAt: completedRow[0]?.occurredAt ?? null,
      openLedgerPositions: openLedger,
      reconAlertCount,
    })

    return res.json(summary)
  } catch (e) {
    return sendApiError(res, e, logger, "desk/recon-summary")
  }
})
