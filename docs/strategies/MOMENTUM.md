# Cash momentum

Long-only NSE cash book. It ranks a stored universe (the bundled list is a Nifty Total Market snapshot, about 750 names) and shows the rank, filters, target weights, and order diff at any time. It does not trade until execution is changed off `report`.

This is not Chase and not the 9:20 short-vol book. A correct run of a losing rank is still a losing rank.

## Switches

| Switch | Off means |
|---|---|
| Page **On** (`active`) | No history pull and no ranking. The symbol list can still be viewed. |
| **Pull data** | The hourly scheduler does not call Kite. **Pull history now** still works while On is enabled. |
| Execution `report` | Orders are calculated and shown. Nothing is sent. This is the default. |
| Execution `manual` | Orders go out only from **Send rebalance**. |
| Execution `auto` | Orders go out on the rebalance day, during the session, once that day. |
| Desk → Risk → Momentum disabled | No orders at all, including sells. |
| Desk halt | New buys stop. Sells still run. |

Data refresh and the scheduler both no-op while On is off.

## Rank

Scores are computed on the full universe first. Filters do not re-rank the survivors. Rank 1 stays rank 1 if it later fails a filter.

| Method | Score |
|---|---|
| `SHARPE_12M` | 252-session Sharpe of daily returns. Default. |
| `RETURN_12M` | Close / close 252 sessions ago − 1 |
| `RETURN_12_1` | Same return, ending 21 sessions ago |

A name with no score is unranked and fails closed.

## Filters

All thresholds are on the Momentum page.

- 12-month and 24-month price multiple caps (default 10×)
- Percent below the high of the stored history (default 25)
- Average daily turnover (close × volume, default ₹1 crore)
- Close above an SMA (default 200 sessions)
- Last month’s return is less than half of the positive 12-month return
- Circuit count and market cap are **off** by default. Kite day candles do not carry a 12-month circuit count or market cap. Strict mode fails a name when that field is missing.

A held name that fails a filter, falls past the worst rank held, or leaves the universe is a sell of the **open quantity**. The sell is never sized from the configured holding count.

## Book

- Holdings count, worst rank held, and entry rank are independent. A new name must be inside the entry rank. A name already held may stay until the worst rank held.
- New names are equal-weight, capped by max weight. Locked **hold weight** stays at that weight even when it is below equal weight, and the rebalance does not buy it back up. **Exclude** sells it and does not buy it again.
- Quantity is `floor(capital × weight / price)`. Capital 0 produces a report and no buy.
- Rebalance is monthly (first NSE session of the month), weekly (weekday 1–5), or ad hoc (never automatic).

## Orders

CNC limit on NSE. Buys are limited a small buffer above the last close, sells a small buffer below. Each order goes through Desk risk. A rejected buy does not create a holding. History is adjusted by Zerodha for splits and bonuses; the rank uses that series as stored.

Code: `lib/momentum/`. Page: `/momentum`. API: `/api/momentum`.
