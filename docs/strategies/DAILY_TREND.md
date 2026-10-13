# Daily long-only trend

A cash version of the Chase **long** side. It reads daily candles on the NSE symbol you add (a stock or an index ETF such as `NIFTYBEES`). It does not trade the future, and it does not open a short when price is below the average.

## Switches

| Switch | Effect |
|---|---|
| Page **On** | Off skips evaluation and history for this strategy. |
| **Pull data** | Off skips the scheduled Kite pull. **Pull history** still runs while On is enabled. |
| Execution `report` | Evaluate shows the decision and sends nothing. Default. |
| Execution `manual` | **Evaluate and send** places the orders. |
| Execution `auto` | The hourly scheduler evaluates and sends during the session. |
| Symbol **On** | Off is fully dark for that symbol: no buy and no stop. |
| Pause | Blocks a new buy. A long book still exits on the stop. |
| Desk → Risk → Daily trend disabled | No orders, including the stop. |
| Desk halt | Blocks the buy. The stop still sells the open quantity. |

Each symbol has its own EMA length, buffer, exit buffer, share quantity, and entry style. Nothing in the signal is fixed at 40 or 0.2 except the form defaults.

## Signal

EMA is the standard daily close EMA.

- Long line = EMA × (1 + buffer%).
- Exit line = EMA × (1 − exit buffer%).
- `CLOSE_CROSS`: a close above the long line buys `quantity` shares. Status stays pending until the book has a long quantity. A rejected buy stays flat.
- `BREAK_HIGH`: that close only arms a buy at that day’s high. The next session buys if the high trades. A close back through the exit line or the stored stop cancels the pending buy and does not sell a flat book.
- Once long, the stop is the lower of the EMA and the signal day’s low. A later close through that stop, or through the exit line, sells the **open quantity**. It does not sell `quantity` if the book is flat, and it does not sell twice into a short.
- A short quantity, if one is already on the book, is bought back to flat. The buy size is the open short, not the configured share count.

## Orders

CNC limit on NSE, through Desk risk. Share quantity is the configured size on entry and the ledger size on exit.

Code: `lib/dailyTrend/engine.ts`, `lib/momentum/trendRun.ts`. Page: `/daily-trend`.
