import { pool } from "../drizzle"
import logger from "../logger"
import { recordAuditEvent } from "./ledger"
import { OPEN_ORDER_STATUSES } from "./types"

export const PAPER_CLEAR_CONFIRM = "CLEAR PAPER"

export function paperClearBlocked(input: {
  openPaperQty: number
  workingPaperOrders: number
}): { ok: true } | { ok: false; error: string } {
  if (input.openPaperQty > 0) {
    return {
      ok: false,
      error: "Square off open paper positions before clearing the paper book.",
    }
  }
  if (input.workingPaperOrders > 0) {
    return {
      ok: false,
      error: "Cancel working paper orders before clearing the paper book.",
    }
  }
  return { ok: true }
}

export type PaperClearCounts = {
  positionsReset: number
  positionEvents: number
  audits: number
  transactions: number
  fees: number
  fills: number
  orders: number
  trades: number
  decisions: number
  positions: number
  sessions: number
  snapshots: number
  signals: number
}

export async function clearPaperBook(input: {
  confirm: string
  actor?: string
}): Promise<{ ok: true; counts: PaperClearCounts } | { ok: false; error: string }> {
  if (input.confirm !== PAPER_CLEAR_CONFIRM) {
    return {
      ok: false,
      error: `Type ${PAPER_CLEAR_CONFIRM} to confirm. This does not send a Kite order.`,
    }
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const open = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM positions
       WHERE provenance IN ('PAPER','MOCK') AND status = 'OPEN' AND quantity <> 0`
    )
    const working = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM orders
       WHERE provenance IN ('PAPER','MOCK') AND status = ANY($1::text[])`,
      [OPEN_ORDER_STATUSES]
    )
    const blocked = paperClearBlocked({
      openPaperQty: Number(open.rows[0]?.n ?? 0),
      workingPaperOrders: Number(working.rows[0]?.n ?? 0),
    })
    if (!blocked.ok) {
      await client.query("ROLLBACK")
      return blocked
    }

    const reset = await client.query(
      `UPDATE positions p SET
         realized_pnl = COALESCE((
           SELECT SUM(pe.realized_delta) FROM position_events pe
           LEFT JOIN fills f ON f.id = pe.fill_id
           WHERE pe.position_id = p.id
             AND (f.provenance IS NULL OR f.provenance NOT IN ('PAPER','MOCK'))
         ), 0),
         fees = COALESCE((
           SELECT SUM(COALESCE(pe.fee_delta, 0)) FROM position_events pe
           LEFT JOIN fills f ON f.id = pe.fill_id
           WHERE pe.position_id = p.id
             AND (f.provenance IS NULL OR f.provenance NOT IN ('PAPER','MOCK'))
         ), 0),
         updated_at = now()
       WHERE p.provenance NOT IN ('PAPER','MOCK')
         AND EXISTS (
           SELECT 1 FROM position_events pe
           JOIN fills f ON f.id = pe.fill_id
           WHERE pe.position_id = p.id AND f.provenance IN ('PAPER','MOCK')
         )`
    )
    const events = await client.query(
      `DELETE FROM position_events pe
       USING fills f
       WHERE pe.fill_id = f.id AND f.provenance IN ('PAPER','MOCK')`
    )
    const audits = await client.query(
      `DELETE FROM audit_events
       WHERE order_id IN (SELECT id FROM orders WHERE provenance IN ('PAPER','MOCK'))
          OR trade_id IN (SELECT id FROM trades WHERE provenance IN ('PAPER','MOCK'))
          OR decision_id IN (SELECT id FROM trading_decisions WHERE provenance IN ('PAPER','MOCK'))
          OR detail->>'book' IN ('PAPER','MOCK')
          OR detail->>'provenance' IN ('PAPER','MOCK')`
    )
    const transactions = await client.query(
      `DELETE FROM transactions
       WHERE order_id IN (
         SELECT broker_order_id FROM orders
         WHERE provenance IN ('PAPER','MOCK') AND broker_order_id IS NOT NULL
       )`
    )
    const fees = await client.query(
      `DELETE FROM fees
       WHERE provenance IN ('PAPER','MOCK')
          OR fill_id IN (SELECT id FROM fills WHERE provenance IN ('PAPER','MOCK'))
          OR order_id IN (SELECT id FROM orders WHERE provenance IN ('PAPER','MOCK'))
          OR trade_id IN (SELECT id FROM trades WHERE provenance IN ('PAPER','MOCK'))`
    )
    const signals = await client.query(
      `DELETE FROM strategy_signals
       WHERE features->>'provenance' IN ('PAPER','MOCK')
          OR features->>'book' IN ('PAPER','MOCK')`
    )
    const fillsDeleted = await client.query(
      `DELETE FROM fills WHERE provenance IN ('PAPER','MOCK')`
    )
    const ordersDeleted = await client.query(
      `DELETE FROM orders WHERE provenance IN ('PAPER','MOCK')`
    )
    const tradesDeleted = await client.query(
      `DELETE FROM trades WHERE provenance IN ('PAPER','MOCK')`
    )
    const decisions = await client.query(
      `DELETE FROM trading_decisions WHERE provenance IN ('PAPER','MOCK')`
    )
    const positions = await client.query(
      `DELETE FROM positions
       WHERE provenance IN ('PAPER','MOCK') AND quantity = 0`
    )
    const sessions = await client.query(
      `DELETE FROM daily_sessions ds
       WHERE NOT EXISTS (
         SELECT 1 FROM fills f
         WHERE f.provenance NOT IN ('PAPER','MOCK')
           AND (f.occurred_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM trades t
         WHERE t.provenance NOT IN ('PAPER','MOCK')
           AND t.status = 'CLOSED'
           AND t.exit_at IS NOT NULL
           AND (t.exit_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM orders o
         WHERE o.provenance NOT IN ('PAPER','MOCK')
           AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
       )`
    )
    await client.query(
      `UPDATE daily_sessions ds SET
         realized_pnl = COALESCE((
           SELECT SUM(net_pnl::numeric) FROM trades t
           WHERE t.status = 'CLOSED'
             AND t.provenance NOT IN ('PAPER','MOCK')
             AND t.exit_at IS NOT NULL
             AND (t.exit_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
         ), 0),
         gross_pnl = COALESCE((
           SELECT SUM(gross_pnl::numeric) FROM trades t
           WHERE t.status = 'CLOSED'
             AND t.provenance NOT IN ('PAPER','MOCK')
             AND t.exit_at IS NOT NULL
             AND (t.exit_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
         ), 0),
         net_pnl = COALESCE((
           SELECT SUM(net_pnl::numeric) FROM trades t
           WHERE t.status = 'CLOSED'
             AND t.provenance NOT IN ('PAPER','MOCK')
             AND t.exit_at IS NOT NULL
             AND (t.exit_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
         ), 0),
         trade_count = COALESCE((
           SELECT COUNT(*)::int FROM trades t
           WHERE t.status = 'CLOSED'
             AND t.provenance NOT IN ('PAPER','MOCK')
             AND t.exit_at IS NOT NULL
             AND (t.exit_at AT TIME ZONE 'Asia/Kolkata')::date = ds.session_date
         ), 0),
         updated_at = now()`
    )
    const snapshots = await client.query(
      `DELETE FROM portfolio_snapshots ps
       WHERE NOT EXISTS (
         SELECT 1 FROM fills f
         WHERE f.provenance NOT IN ('PAPER','MOCK')
           AND (f.occurred_at AT TIME ZONE 'Asia/Kolkata')::date = ps.session_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM orders o
         WHERE o.provenance NOT IN ('PAPER','MOCK')
           AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = ps.session_date
       )`
    )
    await client.query("COMMIT")

    const counts: PaperClearCounts = {
      positionsReset: reset.rowCount ?? 0,
      positionEvents: events.rowCount ?? 0,
      audits: audits.rowCount ?? 0,
      transactions: transactions.rowCount ?? 0,
      fees: fees.rowCount ?? 0,
      fills: fillsDeleted.rowCount ?? 0,
      orders: ordersDeleted.rowCount ?? 0,
      trades: tradesDeleted.rowCount ?? 0,
      decisions: decisions.rowCount ?? 0,
      positions: positions.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
      snapshots: snapshots.rowCount ?? 0,
      signals: signals.rowCount ?? 0,
    }
    await recordAuditEvent({
      eventType: "MANUAL_INTERVENTION",
      actor: input.actor ?? "USER",
      severity: "WARN",
      summary: "Cleared paper and mock ledger rows",
      detail: { source: "LEDGER", book: "LIVE", clearedBook: "PAPER", ...counts },
      idempotencyKey: `paper-clear:${new Date().toISOString()}`,
    })
    logger.info("[clearPaperBook] cleared", counts)
    return { ok: true, counts }
  } catch (e) {
    try {
      await client.query("ROLLBACK")
    } catch {
      /* already closed */
    }
    throw e
  } finally {
    client.release()
  }
}
