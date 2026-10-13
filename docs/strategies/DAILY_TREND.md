# Daily long-only trend

A cash version of the Chase **long** side. It reads **daily** candles on an NSE cash symbol you add (a stock or an index ETF such as `NIFTYBEES` or `M&M`). It does not trade the future, it does not use hourly candles, and it does not open a short when price is below the average.

This is not Chase and not the 9:20 short-vol book. A correct run of a losing trend is still a losing trend.

## What the hour loop is

The process wakes about 20 seconds after boot, then every hour (`lib/momentum/scheduler.ts`). That wake-up is shared with cash momentum. It is not an hourly signal.

1. Pull NSE **day** candles from Kite, at most once per IST day, and only while the strategy is on and **Pull data** is on. **Pull history** on the page still runs while On is enabled.
2. Re-read the last stored day bar and, if execution is `auto`, send the order that bar already implies.

Later hours the same day do not fetch a new candle. They look at the bar from the first successful pull of that IST day. That is why a buy Kite refused can be sent again without waiting for the next official close.

The first pull of the day happens whenever that pass runs. If the process is up during the session, Kite can return **today’s candle so far**. The signal then uses that partial close, not the 15:30 close. The finished day is what the next day’s pull stores. There is no separate “wait until the close” job.

## Switches

| Switch | Effect |
|---|---|
| Page **On** | Off skips evaluation and history for this strategy. |
| **Pull data** | Off skips the scheduled Kite pull. **Pull history** still runs while On is enabled. |
| Execution `report` | Evaluate shows the decision and sends nothing. Default. |
| Execution `manual` | **Evaluate and send** places the orders. Nothing is retried on its own. |
| Execution `auto` | The hourly pass evaluates and sends. It does not also require the market-session check that momentum uses. |
| Symbol **On** | Off is fully dark for that symbol: no buy and no stop. |
| Pause | Blocks a new buy. A long book still exits on the stop. |
| Desk → Risk → Daily trend disabled | No orders, including the stop. The card starts off. Share count is set on this page, not as max lots. |
| Desk halt | Blocks the buy. The stop still sells the open quantity. |

Each symbol has its own EMA length, buffer, exit buffer, share quantity, and entry style. Nothing in the signal is fixed at 40 or 0.2 except the form defaults. The limit buffer (default 0.15%, capped at 5%) is on the strategy runtime, shared by every symbol: a buy limit is the last close × (1 + buffer), a sell limit is the last close × (1 − buffer), rounded to ₹0.05.

## Symbol

A symbol is accepted only when it is an NSE cash instrument (`instrument_type` EQ) on the Kite instrument dump for the logged-in session. `M&M` is valid. `123` is rejected because it does not look like an NSE symbol. `ABC` looks like one and is still rejected because it is not listed. The check needs a Kite session. If the instrument dump cannot be loaded, the save is refused rather than stored.

The database check allows `A`–`Z`, digits, `&`, and `-`, and requires a letter first (`drizzle/0020_nse_cash_symbol.sql`). That shape is not a listing check. Names already saved that failed the shape are deleted by that migration.

## Signal

EMA is the standard daily close EMA. The seed is the SMA of the first `period` closes, then `k = 2 / (period + 1)`.

- Long line = EMA × (1 + buffer%).
- Exit line = EMA × (1 − exit buffer%).
- `CLOSE_CROSS`: a close above the long line buys `quantity` shares. Status stays `PENDING_LONG` until the book has a long quantity. A rejected buy stays `FLAT`.
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
| Symbol listing check | `lib/nseCashSymbol.ts` |
| Page | `/daily-trend` |
| API | `POST /api/daily-trend` actions `save-book`, `remove-book`, `pull`, `evaluate` |

Tables: `daily_trend_settings`, `daily_trend_books`, `equity_daily_bars` (`drizzle/0019_momentum_and_daily_trend.sql`).
