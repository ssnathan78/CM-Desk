# Agent guide: books, quantity, and P&L

Read this before changing orders, fills, positions, Chase exits, paper/live, or any Desk number the operator might trade on.

CM-Desk is a personal strategy desk. The **ledger** is the desk’s record. **Kite** is execution reality. They are allowed to differ for known reasons. A bug is a difference the operator cannot explain, or a label that presents two different measures as the same number.

Strategy behaviour still comes from [docs/strategies/](strategies/README.md). This file is how to change the desk without breaking the books.

## Allowed differences (not a bug by themselves)

| Desk | Kite / other | Why |
|---|---|---|
| Unrealized = average cost vs mark on **open** qty | NRML unrealised is often today vs previous close, and today-only | Different marks. Do not “fix” one to equal the other. |
| Position **Realized lifetime** | Kite day P&L | The row’s realized is the life of that book. |
| Sessions **Net P&L** | Kite day P&L, and position realized | Sessions sum **closed** round-trips whose `exit_at` is that IST date. An open Chase book is not in that column until it closes. |
| **Margin + open MTM** | Kite equity, Sessions net | Kite available margin plus desk unrealized. Drawdown is the peak of that figure minus the current one. It is not the day’s P&L. |

If the UI shows any of these under one label, that **is** a bug. The account strip must keep the words **Margin + open MTM** and **Realized lifetime**.

## Boundaries

- Signed qty: BUY `+`, SELL `−`. Average-cost. `OPEN` iff qty ≠ 0. `FLAT` iff 0.
- Qty 0 → unrealized **0** and market value **0**. A leftover mark is not a second P&L pile. Do not add it into realized; the close fill already booked realized.
- An **open** qty with no mark keeps the stored unrealized. Do not substitute the average. That prints 0 and looks like a flat book. Use `unrealizedForPosition` / `presentLedgerPosition`. `signedQty` because Postgres may return `"0"`.
- Flatten, stop, and Chase rollover size come from the **open book** (Kite net when the broker answered, otherwise the live ledger). Never from configured lots. Lots-as-qty **opens** a position on a flat book.
- Paper (`PAPER` / `MOCK`) and live (`LIVE` / `RECONCILED` / `MIGRATED`) never share quantity. A paper leftover must not be sent to Kite. A live leftover blocks a new paper book.
- `MOCK_ORDERS=true` has no broker book. Paper mode on a **live** process (`MOCK_ORDERS=false`, strategy still Paper) **must read Kite**. A failed read is unknown, not flat.
- Halt and trading-disabled block **entries** only. Flatten and stop-loss still go out. Strategy **disabled** is fully dark, including flatten.
- LONG/SHORT (and Chase leaving `AWAITING_*`) requires a **fill**, not a candle or a submitted order.
- 9:20 short straddle/strangle: per-leg stop. One wing stopped does **not** flatten the other. The leftover wing stays until auto square-off.
- Chase is continuous NRML futures. Overnight is specified. Expiry day flattens the front month at 15:00 IST and reopens the next month at the **open** quantity, not at configured lots. Do not invent a cash-settlement fill.

## Guard rails (do not reintroduce these)

These are the failures that already lost agreement between status, quantity, and P&L. New code must keep the same shape.

### 1. A flatten is not an entry

`inferOrderRole` treats a bare `MARKET` as `ENTRY`. Halt, trading-disabled, and max notional then reject it.

The 09:16 Chase exit goes through `planChaseMorningExit`. The order’s `purpose` is `FLATTEN`. Status stays LONG/SHORT until `planChaseMorningExit` says `AWAITING_SIGNAL` (quantity is flat). Do not write the exit log or the “awaiting signal” Slack line before that. A rejected order leaves the status unchanged so the next pass can retry.

Any new exit, square-off, or stop must set `purpose` to `FLATTEN`, `SL`, or `EXIT` **before** `placeOrder` / `evaluateOrder`. Do not flip strategy status to flat until the watched quantity is 0.

### 2. Cover size is this open book, not today’s order blotter

`chaseCoverOrderQty` is the size of a new Chase cover.

- Kite net is the quantity to trade when the position read succeeded.
- `chaseEpisodeCoverFillQty` counts protective stops **and** market/limit covers on the cover side **at or after** the round-trip `openedAt`. An earlier fill the same day must not make the new book look already covered.
- Subtract a fill only when the Kite net has **not** already dropped by that much from the size the round-trip opened at (`openRoundTripSize` → trade `entry_qty`, not the current position qty).
- If those fills already cover the displayed net, send **nothing** (`already_covered`). A second market order reverses into a new position.
- A naive timestamp from Kite is IST (`Asia/Kolkata`), not UTC.

Do not write `openQty - sum(all of today’s stop fills)` inline in the queue. Call these functions.

### 3. A failed Kite read is not quantity 0

`kiteNetQuantity` throws `KitePositionsUnavailableError` when `positions.net` is missing. An empty net array for that symbol **is** flat.

`getNetPositionQty` rethrows when `strict` or `ledgerFallback: false` (`rethrowKiteQtyFailure`). Callers must treat that throw as **unknown**:

| Caller | On unknown |
|---|---|
| Chase entry (`decideChaseEntryAction` with `kiteQtyKnown: false`) | Wait. Do not place. Do not flip status. |
| Chase cover / 09:16 exit | Do not send. Do not clear LONG/SHORT. |
| Desk square-off | `kiteQueried` stays false. Do not skip as “broker already flat”. |
| Clear phantom | `kiteAvailable` false. Do not zero a live row. |
| Paper ↔ Live switch | 409. Do not switch. |

Paper Chase calls this even when the strategy is Paper, unless the process itself is `MOCK_ORDERS`. `resolveChaseBookBreakdown` sets `kiteQtyKnown` from that read.

### 4. The order is not filled until the fill row exists

`applyBrokerOrderSnapshot` books the incremental fill **before** it advances `orders.filled_qty`. `commitBrokerFillProgress` keeps the previous filled qty and does **not** move status to `FILLED` / `PARTIALLY_FILLED` when the insert failed, so the next snapshot retries. Cancel and reject still land.

Do not set `filled_qty` from Kite and then insert the fill. A crash between those two steps leaves Orders filled and Positions flat, and the retry condition (`filled > stored`) never fires again.

A closing fill with **no** open `trades` row still inserts a `CLOSED` trade via `orphanCloseTradeFields` (direction from the quantity **before** the fill, not from `-closedQty`). Sessions Net only sums closed trades. Position realized without that row is invisible on Sessions.

### 5. Do not mix measures in a new tile

| Figure | Function / source | Say this |
|---|---|---|
| Open unrealized | `unrealizedForPosition` | Average cost vs mark. 0 when qty is 0. |
| Realized on a position or the account strip | Sum of `positions.realized_pnl` | **Realized lifetime** |
| Today’s closed P&L | `trades` `CLOSED` + `exit_at` that IST date | **Net P&L** / closed today |
| Margin + open MTM | Kite `available.live_balance` (or `equity.net`) + desk unrealized | **Margin + open MTM**. Not equity. Not Sessions net. |

`computePortfolio` must not fall back to `averageEntryPrice` as the mark.

## How to implement a change

1. Name the two figures or states that could disagree (status vs qty, ledger vs Kite, Sessions vs realized, cover qty vs an old fill). If you cannot name them, do not start.
2. Read the strategy spec if the change touches Chase, straddle, or strangle. Do not “clean up” a leftover 9:20 wing or flatten an empty Chase book.
3. Put the decision in an existing pure function if one already owns that rule (`planChaseMorningExit`, `planChaseRollover`, `chaseCoverOrderQty`, `chaseEpisodeCoverFillQty`, `commitBrokerFillProgress`, `unrealizedForPosition`, `kiteNetQuantity`, `planChaseSlBreachFlatten`, `evaluateOrder`, `resolveSquareOffBook`, `liveFlattenSessionBlock`). Do not copy the rule into a queue or a React component. Sending, modifying, cancelling, or refusing an order also follows [AGENT_ORDER_SAFETY.md](AGENT_ORDER_SAFETY.md).
4. Add a unit test that fails if the bug returns. Prefer a table of inputs, not one happy path. Minimum when the change can hit them:
   - Rejected entry does not leave LONG/SHORT with qty 0.
   - Flat book flatten qty is 0, not configured lots.
   - Halt / trading-disabled still allows `FLATTEN` and `SL`. Strategy disabled does not.
   - A filled cover does not send a second market order.
   - A same-day re-entry is not “already covered” by the previous round-trip’s fill.
   - Kite `net` missing throws; an empty net is 0.
   - Fill row not saved → order filled qty stays put.
   - Qty 0 → unrealized 0. Missing mark on an open qty does not become 0 via the average.
5. If the path places, flattens, or mixes paper and live, add a named scenario in `lib/simulation/catalog.ts` when a sim actor already runs that code. If the actor does not (the 09:16 Chase branch does not), the unit test of the production function is the gate. Say which one you ran.
6. Run `yarn unit-test` and `yarn sim-test`. Ledger writes also want `yarn int-test` when Postgres is up.
7. Update this file and the strategy spec if the **rule** changed. A new tile needs the measure named in the label, not only in a tooltip on a different tile.

## Where the code lives

| Rule | Code | Test |
|---|---|---|
| Morning exit stays on the side until flat; order purpose is flatten | `planChaseMorningExit` in `lib/chaseFill.ts`, called from `lib/queue-processor/chaseQueue.ts` | `__tests__/unit/strategies/chaseFill.test.ts` |
| Cover qty and episode fills | `chaseCoverOrderQty`, `chaseEpisodeCoverFillQty` | same file |
| Entry waits when Kite qty is unknown | `decideChaseEntryAction`, `resolveChaseBookBreakdown` | `__tests__/unit/strategies/chaseSignal.test.ts` |
| Missing Kite book vs flat symbol | `lib/trading/kitePositions.ts`, `getNetPositionQty` | `__tests__/unit/trading/invariants.test.ts` |
| Filled qty only after the fill row | `commitBrokerFillProgress` in `lib/trading/kiteMap.ts` | same invariants test |
| Open unrealized and orphan close | `unrealizedForPosition`, `orphanCloseTradeFields` in `lib/trading/accounting.ts` | `__tests__/unit/trading/accounting.test.ts` |
| Account labels | `components/desk/AccountStrip.tsx`, `components/desk/views/DeskSummaryTiles.tsx` | — |
| Who may send, modify, or cancel an order | [AGENT_ORDER_SAFETY.md](AGENT_ORDER_SAFETY.md) | `__tests__/unit/trading/exitSafety.test.ts` |
