---
name: desk-pnl-diagnosis
description: Explains Desk vs Kite unrealized/realized, flat leftover MTM, expired contracts, and Sessions tab columns. Use when the operator asks about P&L, unrealized on FLAT rows, Kite mismatch, drawdown, win rate, or Desk → Sessions / Positions.
---

# Desk P&L diagnosis

## Positions

1. Qty 0 → status FLAT → **Unrealized must be 0**. Stored `unrealized_pnl` can be stale last MTM; API/UI must use `presentLedgerPosition` / `signedQty` (pg qty may be `"0"`).
2. Do **not** add leftover mark into Realized. Close fills already booked realized.
3. **Desk Unrealized** (open) = average-cost vs mark: short `(avg − mark) × |qty|`.
4. **Kite Unrealised** on overnight NRML is often **today vs previous close**, and **today-only**. Desk realized on a row is **lifetime** of that book. They will disagree; that is not automatically a bug.
5. Expired / rolled futures: no open risk. Chase flattens front at 15:00 IST; there is no separate expiry-settlement booking unless a fill hit the ledger.

## Sessions

| Column | Source |
|---|---|
| Net P&L | Sum `trades.net_pnl` **CLOSED** with `exit_at` on that IST date |
| Fees | Those trades (often 0 — not ingested from Kite) |
| Trades / Wins | Closed round-trips; win = net > 0 |
| Win rate | `wins/trades` as a **fraction** (1 = 100%), not a percent label |
| Drawdown | Last snapshot that day: peak equity − (cash + unrealized). **Not** that day’s P&L. Days with 0 trades can still have drawdown. |

Open Chase overnight does not appear in session Net P&L until a round-trip **closes**.

## Code

- Accounting: `lib/trading/accounting.ts`
- List/scrub: `lib/trading/portfolio.ts` `listPositions`, `upsertDailySession`
- UI: `pages/desk.tsx` Positions + Sessions
