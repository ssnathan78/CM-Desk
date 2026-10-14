# Cash momentum

Long-only NSE cash book. It ranks a stored universe (the bundled list is a Nifty Total Market snapshot, about 750 names, including `M&M`) and shows the rank, filters, target weights, and order diff at any time. It does not trade until execution is changed off `report`.

This is not Chase and not the 9:20 short-vol book. A correct run of a losing rank is still a losing rank. The published sheet this follows ranks first and filters later. Filters do not re-rank. Adding capital during a drawdown is operator funding, not a signal in this app.

## Candles and the hour loop

History is Kite **day** candles, about 1,100 calendar days, one symbol at a time with a 350ms pause. The pull runs at most once per IST day, and only while the page is **On** and **Pull data daily** is on. **Pull history now** still runs while On is enabled even if Pull data daily is off.

The same hourly pass as daily trend (`lib/momentum/scheduler.ts`, 20s after boot, then every hour) then asks whether **today** is a rebalance day and whether this IST day was already marked done. It does not build an hourly rank. Later hours reuse the day bars stored on the first pull.

Zerodha adjusts those candles for splits, bonuses, rights, spin-offs, and extraordinary dividends. Ordinary dividends are not adjusted. There is no unadjusted series and no corporate-actions API. The rank uses the stored series as Kite returned it.

The universe file is `data/universe/nifty-total-market.csv`. The production image copies `data/` or the list never seeds. An empty `momentum_universe` table is filled from that file on the first report. Symbols the old pattern dropped because of `&` (`M&M`, `M&MFIN`) are inserted on a later report if they are still missing. The file is a snapshot, not point-in-time index membership, and it does not know delistings after the snapshot.

## Switches

| Switch | Off means |
|---|---|
| Page **On** (`active`) | No history pull and no ranking. The symbol list can still be viewed, with the reason “strategy is off”. |
| **Pull data daily** | The hourly scheduler does not call Kite. **Pull history now** still works while On is enabled. |
| Execution `report` | Orders are calculated and shown. Nothing is sent. This is the default. |
| Execution `manual` | Orders go out only from **Send rebalance**. |
| Execution `auto` | Orders go out on the rebalance day, during the NSE session, once that IST day. A rejected buy is not retried that day. |
| Rebalance `adhoc` | No day is ever due, so auto does not send. The order diff is still calculated. **Send rebalance** sends it when execution is Manual. |
| Desk → Risk → Momentum disabled | No orders at all, including sells. The card starts off. |
| Desk halt | New buys stop. Sells still run. |

## Rank

Scores are computed on the full universe first. Filters do not re-rank the survivors. Rank 1 stays rank 1 if it later fails a filter. Ties break by symbol ascending. A null score is unranked.

Session counts are fixed: 21, 252, and 504 trading rows in the stored series. They are not calendar months.

| Method | Score |
|---|---|
| `SHARPE_12M` | Mean of the last 252 daily returns, divided by their sample standard deviation, times √252. Needs 253 closes. Default. |
| `RETURN_12M` | Close / close 252 sessions ago − 1 |
| `RETURN_12_1` | The same return ending 21 sessions ago (skip the last month) |

A name with no score is unranked and fails closed.

## Filters

All thresholds are on the Momentum page, behind **Filters**. Defaults:

| Filter | Default | Fail |
|---|---|---|
| 12-month price multiple | 10× | `1 + roc12` at or above the cap, or 12-month history missing |
| 24-month price multiple | 10× | same for 504 sessions |
| Max percent below the stored high | 25 | close is farther than that from the high of the stored bars |
| Min average turnover | ₹1 crore | mean of `close × volume` over the last 21 sessions |
| SMA | 200 sessions, must be above | close at or below that average |
| Last month vs 12-month | 0.5 | when the 12-month return is positive, `roc1 / roc12` at or above 0.5 |
| 12-month return | must be positive | not strictly above 0 |
| Market cap | off | Strict fails a name with no stored market cap, or below the minimum. The refresh covers the daily-trend book, not all 750 |

Circuit count is not a filter. Kite day candles do not include it, and a strict reading of a missing count used to fail every name. A saved `circuitFilter: strict` is ignored and rewritten to off the next time the config is saved.

A held name that fails a filter (`exitWhenFilterBreaks`, default on), falls past the worst rank held, or leaves the universe is a sell of the **open quantity**. The sell is never sized from the configured holding count.

## Book

- Holdings count, worst rank held, and entry rank are independent. Defaults are 30, 75, and 75. A new name must be inside the entry rank. A name already held may stay until the worst rank held.
- Equal-weight slot is `100 / holdingsCount`, then capped by max weight (default 10%). Min weight (default 2%) is stored on the config. Target quantity is `floor(capital × weight / last completed close)`.
- **Capital INR** is the rupee budget for the whole book. Capital 0 produces weights and no buys.
- Minimum turnover is the mean of close × volume over the last 21 stored sessions. It appears after a history pull.
- Locked **hold weight** keeps the target at `min(held quantity, quantity from the locked weight)`. The rebalance does not buy it back up to equal weight. **Exclude** sells the open quantity and does not buy the name again.
- A top-up buy of a name that is already held and still selected is a buy. It is not a new leader.
- Rebalance is monthly (first NSE session of the month), weekly (ISO weekday 1–5, default Monday), or ad hoc (never automatic). The weekday field is shown only when rebalance is weekly.

## Buttons

| Button | What it does |
|---|---|
| **Save** | Writes the switches on this page. Strategy on here is not Desk → Risk. |
| **Pull history now** | Saves the switches, starts the momentum-universe download, and returns immediately. A bar shows which name is in progress. It needs Strategy on. Desk → Risk does not start this pull. |
| **Preview orders** | Rebuilds the buy and sell diff from the stored candles and sends nothing. |
| **Send rebalance** | Sends that diff. Disabled while execution is Report only. Manual sends on click. Auto also sends on the rebalance day without this click. |

The rank and the diff use the last completed daily close. A candle dated today is ignored.

The rank table reads stored candles in batches of 20 names and drops each batch before the next, so opening or saving the page does not load the whole history into memory at once. Save writes the switches and does not download candles. A history download runs only from **Pull history now**, or from the hourly pass when Strategy on and Pull data daily are both on, once per IST day. That download is one Kite request per name and is the large transfer.

## Orders and a short Zerodha balance

CNC limit on NSE, validity DAY, tag `momentum`, strategy `MOMENTUM`. Buy limit is the last close × (1 + buffer), sell limit is the last close × (1 − buffer). The buffer defaults to 0.15% and is capped at 5%. Prices round to ₹0.05. Each order goes through Desk risk. Lots are not sent, so the options max-lots cap is not applied to the share count. Desk max quantity per order and max notional still apply.

The desk does not read the Zerodha balance before sending. A shortfall is Kite rejecting the order. Each throw is a Desk → Alerts row (`BROKER_ERROR`). A rejected buy does not create a holding.

| Mode | After a rejection |
|---|---|
| `auto` | The pass still marks this IST day done (`last_rebalance_on`), including when every order fails and when only some fail. Later hours the same day do not send again. The next automatic attempt is the next rebalance day. Names that never filled are still buys then, if they still qualify. |
| `manual` | **Send rebalance** can be clicked again the same day. The once-a-day mark blocks only the scheduler. The page’s success message does not mean every order was accepted. |
| `report` | Nothing is sent. |

Paper mode and `MOCK_ORDERS=true` fill the desk ledger and never see the Zerodha balance.

## Desk

There is no separate desk tab for this strategy.

| Tab | What you see |
|---|---|
| Orders | The CNC order, including a rejection. Tag `momentum`. This tab has no Strategy column. |
| Positions | The name after a fill. Strategy `MOMENTUM`. A refused order is not a position. |
| Trades | The round-trip, with that strategy, once the ledger has opened it. |
| Sessions | Only round-trips that **closed** that IST day. An open holding stays on Positions. |
| Alerts | The broker or risk rejection. |
| Signals | Nothing. This strategy does not write `strategy_signals`. The rank table is on `/momentum`. |
| Risk | Enable, halt, paper/live, max open positions. The card starts off. Max lots is hidden because size is `floor(capital × weight / price)`. |

## Code

| Piece | Path |
|---|---|
| Rank, filters, weights, order diff | `lib/momentum/engine.ts` |
| Config and the report / manual / auto gate | `lib/momentum/types.ts` |
| First session of the month, IST date | `lib/momentum/calendar.ts` |
| Universe CSV | `lib/momentum/universe.ts`, `data/universe/nifty-total-market.csv` |
| Settings, locks, bars | `lib/momentum/store.ts` |
| Day-candle pull | `lib/momentum/history.ts` |
| Hourly pass | `lib/momentum/scheduler.ts` |
| CNC submit | `lib/momentum/execute.ts` |
| Page | `/momentum` |
| API | `/api/momentum` |

Tables: `momentum_settings`, `momentum_universe`, `momentum_weight_locks`, `equity_daily_bars` (`drizzle/0019_momentum_and_daily_trend.sql`).
