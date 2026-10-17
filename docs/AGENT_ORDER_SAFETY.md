# Agent guide: order safety

Read this before adding or changing any path that places, modifies, cancels, sizes, or refuses an order. Books and P&L rules are in [AGENT_BOOKS_AND_PNL.md](AGENT_BOOKS_AND_PNL.md). Strategy behaviour is in [docs/strategies/](strategies/README.md). This file is how an order is allowed to leave the desk.

CM-Desk is a personal strategy desk. `evaluateOrder` in `lib/trading/riskEngine.ts` is the pre-trade gate. Strategy code, a queue, a watcher, and a React button do not get a second rule.

## Conditions

Live Kite for a **new entry** needs all three: `MOCK_ORDERS=false`, Desk → Risk “Allow live orders”, and that strategy’s Execution = Live. `LIVE_BLOCKED` applies to `ENTRY` only. A flatten or stop on a book that is already Live still requires `MOCK_ORDERS=false` and Execution = Live, and it still calls `evaluateOrder`.

| Control | Code | Entries | Flatten / SL / EXIT |
|---|---|---|---|
| Trading enabled off | `TRADING_DISABLED` | blocked | allowed |
| Halt new entries | `DESK_HALTED` + stored reason | blocked | allowed |
| Strategy “Not halted” off | `STRATEGY_HALTED` | blocked | allowed |
| Strategy enabled off | `STRATEGY_DISABLED` | blocked | **blocked** |
| Allow live orders off | `LIVE_BLOCKED` | blocked when the book is Live | still evaluated; strategy disabled and the session rule below still apply |
| Market closed, live book | `MARKET_CLOSED` via `liveFlattenSessionBlock` | entry hours use the Desk “require market hours” toggle | **refused**. The position and its stop stay. Paper still flattens |

Halt is the loud kill (`KILL_SWITCH`). Resume (`resumeDesk`) clears the halt **and** sets `tradingEnabled` true. Trading enabled off is quiet config. Resume is manual. Workers do not clear a halt.

Chase page **Trade this book** and **Pause entries** are not Desk → Risk. Trade this book off skips hourly candles for a flat book. Pause blocks new Chase entries on that index. An open LONG/SHORT still trails. Desk → Risk “Chase enabled” off is darker: it rejects every Chase order, including flatten.

## Boundaries

- A new broker order goes through `placeOrder` (`lib/kiteUtils.ts`), which calls `assertOrderAllowed`. Do not call `kite.placeOrder` from a strategy, queue, or watcher.
- `kite.modifyOrder` and `kite.cancelOrder` on a protective stop do **not** pass through `placeOrder`. Call `assertLiveBrokerMutation` first (`lib/trading/riskGate.ts`). It refuses a paper book, refuses a live exit while the market is closed, then calls `assertOrderAllowed` with role `FLATTEN`, `SL`, or `EXIT`.
- Paper execution never calls `kite.modifyOrder` or `kite.cancelOrder`. `placeSL` resolves the paper ledger only and returns before the live order book. `planChaseRollover` sets `touchKite: false` for a paper book.
- `resolveSquareOffBook` (`lib/trading/exitSafety.ts`) is the square-off book. Mock mode is paper. A named Paper strategy is paper. A named Live strategy is live. **No strategy is a refuse**, not a default. Unknown strategies are Paper for a *new entry* (`isPaperStrategy`) so a new book cannot punch Kite. That default is wrong for a square-off: it paper-fills a live row, or sizes from Kite and then stores a paper fill.
- `strategyFromOrderTag` resolves a job tag. The tag `chase` is Chase and has no job row. Pass that strategy into `placeOrder` and into `resolveSquareOffBook`.
- `protectiveOrderMatchesJob` cancels a resting stop only when the tag, symbol, product, exchange, and absolute quantity match. Same symbol and quantity is not enough.
- `chaseMayTouchBrokerStop` is tag `chase` or a blank legacy tag. Any other tag belongs to another strategy.
- Live flatten while the market is closed uses `liveFlattenSessionBlock`. It does **not** follow the Desk “require market hours” toggle. That toggle is for entries. `placeOrder` applies the session block to every live non-entry **before** it writes a ledger order.
- `getRiskSettings` throws `RiskSettingsUnavailableError` when the risk row cannot be read. Do not catch that and continue. The old fallback (halted desk, every strategy Paper and enabled) paper-filled live exits.

## Guard rails

These are the failures that already sent, sized, or hid an order. New code keeps the same shape.

### 1. A market order without a purpose is an entry

`inferOrderRole` treats a bare `MARKET` as `ENTRY`. Halt, trading-disabled, max notional, max positions, and Allow live orders then reject a flatten.

Set `purpose` to `FLATTEN`, `SL`, or `EXIT` on the order object before `placeOrder`. The 09:16 Chase exit uses `planChaseMorningExit`: purpose `FLATTEN`, and LONG/SHORT stays until that function returns `AWAITING_SIGNAL` (quantity is flat). A rejected order leaves the status unchanged.

### 2. An entry placed as a stop order is still an entry

Chase does not market-buy the hourly close. It places an `SL` at the day’s high or low, with `purpose: "ENTRY"`. That order type is the strategy. It is not a protective stop.

`inferOrderRole` returns `ENTRY` when purpose is `ENTRY`, including `SL`, `SL-M`, and `SL-L`. Halt, trading-disabled, strategy halt, Allow live orders, max lots, max notional, and max positions then apply. A risk reject leaves Chase in `AWAITING_LONG` or `AWAITING_SHORT`. It does not become `LONG` or `SHORT`.

| Order | Purpose | Role | Halt / trading-disabled |
|---|---|---|---|
| Chase entry at day’s high or low | `ENTRY` | `ENTRY` | blocked |
| Protective stop after a fill | `SL` | `SL` | allowed |
| Stop order type and no purpose | absent | `SL` | allowed |
| 09:16 exit, rollover close, minute cover | `FLATTEN` | `FLATTEN` | allowed |
| Strategy enabled off | any | any | **blocked**, including flatten and SL |

Do not change the Chase entry to a market order so that halt will see it. Do not drop `purpose: "ENTRY"` because the order type is already `SL`. Do not special-case Chase inside `evaluateOrder`. The next strategy that enters with a stop uses the same purpose.

The sim actor passes `role` itself and does not call `inferOrderRole`. The regression test is `__tests__/unit/trading/riskEngine.test.ts` (`Chase entry stop is an entry`). `placeOrder` is the production caller.

### 3. Do not move the book before the exit is accepted

Chase rollover uses `planChaseRollover`.

| Input | Result |
|---|---|
| Strategy disabled | `flatten: "skip"`. Status stays on the front month. No Kite call. |
| Live and market closed | Same skip. Stop stays. |
| Paper | `placeOrder` only. `touchKite` is false. |
| Live and market open | Flatten the front month (modify or replace **this** Chase stop, then a `FLATTEN` order), then the next-month order with `purpose: "ENTRY"`, then move `chase_status`. |

If the flatten or the next-month entry throws, do not move `chase_status` onto the next contract. A halt still allows the flatten and must reject the new-month entry.

### 4. A paper book does not rewrite a Kite order

`placeSL` on a paper Chase book amends the paper stop or calls `placeOrder`. It does not read Kite positions to decide the side, and it does not `modifyOrder` a trigger-pending Kite stop.

`sllWatcher` converts an open SL-L to market only after `assertLiveBrokerMutation`. Mock mode, a missing strategy, or a Paper strategy returns without `modifyOrder`.

Rollover and the Chase stop-breach “convert working stop” path do the same: paper never touches Kite; a live convert calls `assertLiveBrokerMutation` and only for a Chase-owned tag.

### 5. Square-off must name its strategy

`doSquareOffPositions`, `squareOffOrder`, `squareOffTag`, and `doDeletePendingOrders` resolve the strategy from the job or from `strategyFromOrderTag`. `resolveSquareOffBook` then chooses the book.

- Refuse (`SQUARE_OFF_STRATEGY_REQUIRED`) when the strategy is missing and the process is not mock. Do not flatten “all paper rows” and do not size from the account-level Kite net.
- Live and market closed: return or throw `LIVE_FLATTEN_MARKET_CLOSED` **before** cancelling stops. Auto square-off (`autoSquareOffStrat`) records an alert and completes without sending. A delayed same-day job after the close must not retry into the next morning.
- Paper: cancel paper working orders with `cancelPaperWorkingOrders` (symbol **and** tag). Do not `kite.cancelOrder`.
- Live: cancel only `protectiveOrderMatchesJob` hits.

Straddle, strangle, and exit-order rollback call `doSquareOffPositions` with an order tag. The tag lookup is what keeps a filled live leg from being “rolled back” as a paper fill. If you add a caller, pass `strategy` and `orderTag`. Do not pass `{ orderTag }` and assume the default book.

### 6. One strategy does not use another strategy’s quantity

- Open-position caps use `countOpenStrategyPositions` for **this** strategy and **this** book (paper or live).
- Chase stops and covers use `resolveChaseBookBreakdown` for that futures symbol. Paper ledger rows are filtered to Chase.
- A Kite net is the whole account. Square-off may use it only for symbols that belong to **this** job, and only after the book is known to be live. `Math.min(order qty, abs(kite qty))` is this job’s size against that symbol, not a license to cancel another tag’s stop.

### 7. Kill tells the truth

`runDeskKill` sets `chasePaused` only after `pauseAllChaseBooks` resolves, and `deskHalted` only after `haltDesk` resolves. A status-reset failure does not erase a pause that already succeeded.

`killResponseStatus` is 500 when the halt row was not saved. The Desk emergency panel uses `killOperatorNotice`. Do not hard-code “Chase is paused” or “the desk is halted”.

Kill all pauses every Chase index because Chase can be a hedge. Kill intraday does not. A live book left open because the market is closed keeps LONG/SHORT (`chaseBooksKeptOpen`). The pause, when it happened, is the thing the operator must be able to see.

### 8. A failed risk read is not a paper fill

`getRiskSettings` throws `RiskSettingsUnavailableError`. `placeOrder` throws before it writes a fill. `assertOrderAllowed` maps that throw to `RISK_UNAVAILABLE`.

Do not catch the error and substitute `DEFAULT_RISK_SETTINGS` or `defaultStrategyLimits()`. Those defaults are Paper and enabled. An exit would then be marked complete on the live position row (`applyFillById` updates quantity even when provenance stays `LIVE`) while Kite still has the position.

A failed **Kite position** read is a different rule: unknown quantity, not 0. See [AGENT_BOOKS_AND_PNL.md](AGENT_BOOKS_AND_PNL.md). Do not conflate the two.

## How to implement a new feature or fix

1. Name the order role before writing the call. Entry, flatten, stop, or exit. If you cannot name it, the path is not ready. An entry that uses a stop order type is still an entry: set `purpose: "ENTRY"`. A protective stop sets `purpose: "SL"`. Do not infer the role from the order type alone.
2. Name the book. Process mock, strategy Paper, or strategy Live. For a square-off, call `resolveSquareOffBook`. For a new entry, `isPaperStrategy` / `executionProvenance`. Pass the strategy. Look the tag up. Do not leave it blank.
3. Size an exit from the open book (`chaseFlattenQty`, `chaseCoverOrderQty`, `flattenRowPlan`, ledger qty for that strategy and provenance). Configured lots are for a new entry on a flat book.
4. Send a new order only through `placeOrder`, with `purpose` set. Change or cancel a resting Kite stop only through `assertLiveBrokerMutation`, and only when the book is live and the session is open.
5. If the market is closed and the book is live, return before any cancel. Paper may still flatten through `placeOrder`.
6. Update strategy status after the plan says the book is flat or the required orders were accepted. `planChaseMorningExit` and `planChaseRollover` own those decisions. Do not copy them into the queue.
7. Put the decision in a pure function next to the ones above when the rule is new. A queue that inlines the rule will grow a second copy that drifts.
8. Add a unit table that fails if the bug returns. Minimum when the change can hit them:
   - Rejected entry does not leave LONG/SHORT with quantity 0.
   - Flat-book exit quantity is 0, not configured lots.
   - Halt and trading-disabled still allow `FLATTEN` and `SL`. Strategy disabled allows neither.
   - An `SL` / `SL-M` / `SL-L` order with `purpose: "ENTRY"` is rejected by halt, trading-disabled, strategy halt, `LIVE_BLOCKED`, max lots, max notional, and max positions. The same order type with `purpose: "SL"` or no purpose is still allowed under halt.
   - A paper book does not call `kite.modifyOrder` or `kite.cancelOrder`.
   - A live flatten while the market is closed does not cancel the stop and does not send.
   - A square-off with no strategy is refused.
   - A stop cancel requires the same order tag.
   - `getRiskSettings` throws when the read fails. It does not return Paper defaults.
   - Kill reports `chasePaused` and `deskHalted` from what actually succeeded.
9. Add a named scenario in `lib/simulation/catalog.ts` when a sim actor already runs that code. If the actor does not (direct `kite.modifyOrder`, risk-row outage, Kill pause), the unit test of the production function is the gate. Say which one you ran.
10. Run `yarn unit-test` and `yarn sim-test`. Risk settings and ledger writes also want `yarn api-test` / `yarn int-test` when Postgres is up.
11. Update this file if the **rule** changed. A comment in the queue is not the rule.

## Where the code lives

| Rule | Code | Test |
|---|---|---|
| Entry vs flatten vs stop | `inferOrderRole`, `evaluateOrder` in `lib/trading/riskEngine.ts` | `__tests__/unit/trading/riskEngine.test.ts` |
| Live modify / cancel of a stop | `assertLiveBrokerMutation` in `lib/trading/riskGate.ts` | `__tests__/unit/watchers.test.ts` |
| Live session flatten | `liveFlattenSessionBlock` in `lib/flattenNotice.ts`; also `placeOrder` | `__tests__/unit/flattenOpen.test.ts` |
| Square-off book, tag match, Chase stop ownership, rollover gate | `lib/trading/exitSafety.ts` | `__tests__/unit/trading/exitSafety.test.ts` |
| Risk row missing | `RiskSettingsUnavailableError` in `lib/trading/riskSettings.ts` | `__tests__/unit/trading/riskSettingsFailClosed.test.ts` |
| Kill pause and halt are real | `runDeskKill` in `lib/killDesk.ts`, `killOperatorNotice` in `lib/killNotice.ts` | `__tests__/unit/criticalPaths.test.ts`, `__tests__/unit/trading/exitSafety.test.ts` |
| 09:16 exit purpose and status | `planChaseMorningExit` in `lib/chaseFill.ts` | `__tests__/unit/strategies/chaseFill.test.ts` |
| Paper vs live quantity | `lib/trading/bookSplit.ts` | `__tests__/unit/trading/bookSplit.test.ts` |
