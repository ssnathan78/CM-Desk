# Daily long-only trend

A cash version of the Chase **long** side. It reads **daily** candles on an NSE cash symbol you add (a stock or an index ETF such as `NIFTYBEES` or `M&M`). It does not trade the future, it does not use hourly candles, and it does not open a short when price is below the average.

This is not Chase and not the 9:20 short-vol book. A correct run of a losing trend is still a losing trend.

The same explanation is on Guide → Daily long-only trend (`/help/daily-trend`). Constituent adds and drops are on Desk → Lists.

## Constituents

`daily_trend_books` is the operator book, not the index. The first seed copies Nifty 100 in as off. A weekly check (or Refresh constituents) compares the Nifty 100 file from niftyindices.com (`ind_nifty100list.csv`) with `index_membership`. A new name with no book is inserted off. A removal stays pending until Accept, which deletes that book and does not sell. Accept all does the same for every pending removal. If the book still has open quantity, the stop stops with the book. Dismiss leaves the book. An empty download does not replace the snapshot. A failed download uses the bundled file only when nothing is stored yet. Refresh leaves an existing snapshot in place. The page does not treat extra books (an ETF you added, for example) as index removals.

## What the hour loop is

The process wakes about 20 seconds after boot, then every hour (`lib/momentum/scheduler.ts`). That wake-up is shared with cash momentum. It is not an hourly signal.

1. Pull NSE **day** candles from Kite, at most once per IST day, and only while the strategy is on and **Pull data daily** is on. **Pull history now** still runs while On is enabled.
2. Re-read the last stored day bar and, if execution is `auto`, send the order that bar already implies.

Later hours the same day do not fetch a new candle. They look at the stored day bars. The signal uses the last bar **dated before today**, so a morning pull of today’s unfinished candle is stored and then ignored. A buy Kite refused can be sent again on a later hour while that completed close is still above the band.

## Switches

| Switch | Effect |
|---|---|
| Page **On** | Off skips evaluation and history for this strategy. |
| **Pull data daily** | Off skips the scheduled Kite pull. **Pull history now** still runs while On is enabled. |
| **Pull history now** | Starts a download for every name on this page, including names that are off, and returns immediately. The bar is only this list. A momentum download does not paint its count here. One download runs at a time. |
| Execution `report` | Evaluate shows the decision and sends nothing. Default. |
| Execution `manual` | **Evaluate and send** places the orders. Nothing is retried on its own. |
| Execution `auto` | The hourly pass evaluates and sends. It does not also require the market-session check that momentum uses. |
| Symbol **On** | Off is fully dark for that symbol: no buy and no stop. **Turn all on** and **Turn all off** set that switch on every saved symbol and leave pause, budget, status, and the stop alone. |
| Pause | Blocks a new buy. A long book still exits on the stop. |
| Desk → Risk → Daily trend disabled | No orders, including the stop. The card starts off. Share count is set on this page, not as max lots. |
| Desk halt | Blocks the buy. The stop still sells the open quantity. |

Each symbol has its own EMA length, buffer, exit buffer, rupee budget, and entry style. Nothing in the signal is fixed at 40 or 1 except the form defaults. **Apply to all** writes only the fields you fill onto every saved symbol. Blank fields stay as they are. It does not turn a symbol on or off, and it does not change pause, status, the stored stop, or the open quantity. The limit buffer (default 0.15%, capped at 5%) is on the strategy runtime, shared by every symbol: a buy limit is the last completed close × (1 + buffer), a sell limit is that close × (1 − buffer), rounded to ₹0.05.

## Symbol

A symbol is accepted only when it is an NSE cash instrument (`instrument_type` EQ) on the Kite instrument dump for the logged-in session. `M&M` is valid. `123` is rejected because it does not look like an NSE symbol. `ABC` looks like one and is still rejected because it is not listed. The check needs a Kite session. If the instrument dump cannot be loaded, the save is refused rather than stored.

The database check allows `A`–`Z`, digits, `&`, and `-`, and requires a letter first (`drizzle/0020_nse_cash_symbol.sql`). That shape is not a listing check. Names already saved that failed the shape are deleted by that migration.

Search on the page looks up the NSE cash dump by symbol or company name, the same way Chase searches futures, and adds the name **off**. Names already on the book are omitted from the search results. The filter box on the table searches the rows you already have, including the company name and industry shown under the symbol.

The table keeps On, the icon actions (edit, pause, remove), symbol, state, the completed close, EMA, and a signal on the left of the settings. Close is the last bar dated before today. A newer stored price is shown underneath and waits until the next session. The signal is that same close against the band, including rows that are off: Below the band, Above the band when the budget buys nothing, or Buy and the share count. Signal → Qualifies hides the names under the band. Sorting the Signal column puts the names above the band first. State stays FLAT until a fill. Stop stays blank until the book is long. Row On and a budget do not send an order while Engine on is off or Execution is Report only. Company name, industry, market cap, budget, EMA, buffers, and entry style follow. The grid scrolls inside the page so the horizontal bar stays next to the rows. State, close, and stop are the columns to watch while a book is on.

## Nifty 100

The first time the page loads, the Nifty 100 constituent file is inserted as books with **On** switched off (`drizzle/0021_daily_trend_nifty100.sql` records that the seed ran). A name you later remove is not put back. A book you already saved is left as you saved it.

Market cap is stored in `equity_market_caps` and shown with the date it was saved. The hourly job refreshes about 20 of the oldest figures from Screener, so the Nifty 100 book updates inside a day while the process is running. A failed fetch keeps the previous figure. The signal does not use market cap.

## Signal

EMA is the standard daily close EMA. The seed is the SMA of the first `period` closes, then `k = 2 / (period + 1)`.

- Long line = EMA × (1 + buffer%). Default buffer is 1, so the close must be 1% above the EMA.
- Exit line = EMA × (1 − exit buffer%). Default exit buffer is also 1.
- The decision uses the last daily bar **dated before today**. Today’s candle is ignored, including after the close, until the next IST date stores it as a completed bar. A morning pull cannot trade a partial day.
- Buy size is `floor(budget INR / that close)`. Budget 0 buys nothing. The old share count is not the order size.
- `CLOSE_CROSS`: a close above the long line buys `floor(budget / close)` shares. Status stays `PENDING_LONG` until the book has a long quantity. A rejected buy stays `FLAT`.
- `BREAK_HIGH`: that close only arms a buy at that day’s high. A later bar whose high reaches that entry buys. A close back through the exit line or the stored stop cancels the pending buy and does not sell a flat book.
- Once long, the stop is the lower of the EMA and the signal day’s low. A **later** close through that stop, or through the exit line, sells the **open quantity**. The same day’s low is not a fill, because a daily close cannot trade through that bar’s low.
- It does not sell `quantity` if the book is flat, and it does not sell twice into a short.
- A short quantity, if one is already on the book, is bought back to flat. The buy size is the open short, not the configured share count. Role is flatten, not a new long.

`LONG` is written only when the ledger quantity is already long. The candle alone never sets `LONG`.

## Insufficient funds and other rejections

The desk does not read the Zerodha balance before sending. A shortfall shows up as Kite rejecting the order. That rejection is a Desk → Alerts row (`BROKER_ERROR`) whose text is Kite’s message. The green “finished” snackbar on **Evaluate and send** does not mean the broker accepted the order.

| What happened | Status saved | Next automatic pass |
|---|---|---|
| Kite or Desk risk throws before an order id (typical insufficient funds) | `FLAT` | `CLOSE_CROSS` buys again on the next hour if that stored close is still above the band. `BREAK_HIGH` re-arms on the next hour and can buy on the hour after that, if the stored high is still through the entry. |
| Kite returns an order id, and the exchange rejects it later | `PENDING_LONG` | No second buy. The pending entry stays until a later stored close falls through the exit band or the stored stop, which cancels it. |
| Execution is `manual` | same rules | No retry until you click **Evaluate and send** again. |
| Execution is `report` | status is not updated | Nothing is sent. |

Paper mode and `MOCK_ORDERS=true` fill the desk ledger and never see the Zerodha balance.

## Orders

CNC limit on NSE, validity DAY, tag `dailytrend`, strategy `DAILY_TREND`, through `placeOrder` and Desk risk. Lots are not sent, so the options max-lots cap is not applied to the share count. Desk max quantity per order and max notional still apply.

Share quantity is the configured size on entry and the ledger size on exit.

## Desk

There is no separate desk tab for this strategy.

| Tab | What you see |
|---|---|
| Orders | The CNC order, including a rejection. Tag `dailytrend`. This tab has no Strategy column. |
| Positions | The name after a fill. Strategy `DAILY_TREND`. A refused order is not a position. |
| Trades | The round-trip, with that strategy, once the ledger has opened it. |
| Sessions | Only round-trips that **closed** that IST day. An open swing stays on Positions. |
| Alerts | The broker or risk rejection. |
| Signals | Nothing. This strategy does not write `strategy_signals`. |
| Risk | Enable, halt, paper/live, max open positions. The card starts off. Max lots is hidden because size is the share count on this page. |

## Code

| Piece | Path |
|---|---|
| EMA and the long-only decision | `lib/dailyTrend/engine.ts` |
| Load bars, submit, persist status | `lib/momentum/trendRun.ts` |
| Hourly pass | `lib/momentum/scheduler.ts` |
| Day-candle pull | `lib/momentum/history.ts` |
| CNC submit | `lib/momentum/execute.ts` |
| Symbol listing check and search | `lib/nseCashSymbol.ts` |
| Nifty 100 list and market-cap snapshot | `lib/dailyTrend/nifty100.ts`, `data/universe/nifty-100.csv` |
| Page | `/daily-trend` |
| API | `GET/POST /api/daily-trend`. Search: `GET /api/nse-cash-search?q=` |

Tables: `daily_trend_settings`, `daily_trend_books`, `equity_daily_bars` (`drizzle/0019_momentum_and_daily_trend.sql`).
