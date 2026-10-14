export type HelpTopic = "desk" | "plan" | "straddle" | "strangle" | "chase" | "momentum"

export type HelpPage = {
  title: string
  summary: string
  sections: { id: string; title: string; body: string[] }[]
}

export const HELP_PAGES: Record<HelpTopic, HelpPage> = {
  desk: {
    title: "How the desk is organised",
    summary:
      "CM-Desk is a personal algo desk for Indian index options and Chase on index futures. Intraday structures and Chase are not the same kind of trade.",
    sections: [
      {
        id: "intraday",
        title: "Intraday — Straddle and Strangle",
        body: [
          "These are same-session option structures (classic 9:20: sell CE and PE together, each with its own stop). You either punch them now from the strategy page, or the weekday plan schedules them at the saved run time.",
          "They use MIS by default. When one stop hits, the other wing stays until auto square-off. Each weekday holds at most one template per strategy per index.",
        ],
      },
      {
        id: "continuous",
        title: "Continuous — Chase",
        body: [
          "Chase is a futures process that keeps running across days. Nifty, BankNifty, FinNifty, and Midcap Nifty (MIDCPNIFTY) each have their own lots, EMA, pause, and status. It is not a weekday template.",
          "On Chase, Trade this book is whether that underlying is in the hourly engine. Pause entries only blocks new punches on that book; an open LONG/SHORT still trails until flat. A book that is off and flat does not load candles or write signals. Desk → Risk still treats Chase as one strategy: Paper vs Live, enabled, halt, max lots, and max open positions apply to all Chase books together. Risk Strategy enabled off darkens every Chase flatten too — that is not the Chase-page switch.",
          "Kill intraday on the dashboard does not pause Chase. Kill all (incl. Chase) does. Square off all open gets you out of current books without a halt; Chase can take the next signal.",
        ],
      },
      {
        id: "ledger",
        title: "Desk — orders, positions, history",
        body: [
          "Dashboard Today is still the live punch board. Desk is the application ledger: decisions, order lifecycle, fills, positions, completed round-trips, and audit events.",
          "Desk → Orders is only the blotter: instructions that reached placeOrder (paper, mock, live, or reconciled). A Sunday or after-hours live “Schedule now” never creates an order. That reject is on Desk → Alerts. Mock punches still need at least one index ticked; otherwise nothing is sent.",
          "Desk → Contracts shows the Kite NFO futures and option expiries the strategies will use today (front/next month FUT for Chase, current/next/monthly option dates for straddles and strangles). The contract list is fetched from Kite and cached until 07:00 IST — it is not a Postgres table. Chase stores only the selected indexes and, once in a trade, the tradingsymbol on chase_status.",
          "Desk → Orders, Trades, Alerts, Signals, Decisions, Activity, and Sessions open on today (IST). The same Period menu on each of those tabs also offers this month, this quarter, this year, all time, and a custom range. Sessions is one row per day, so Today is that session. Positions opens on Live only and is not date-filtered, so an overnight book stays visible. All (Live + reconciled) adds broker-reconciled and migrated rows. Paper / mock is separate.",
          "Desk → Alerts is the operator log for silent fails: schedule rejects, queue/job failures, stale square-off discards, risk blocks, broker rejects, Chase data miss, and unresolved recon. The count on the tab follows the Period menu. Clear today, Clear before today, and Clear all hide those rows without deleting the ledger.",
          "Desk → Signals is the persisted evaluation log: Chase hourly EMA vs close (including waiting for signal), straddle skew samples, strangle strike picks. It opens on today and uses the same Period menu. Filter by strategy, weekday plan, or a single job. Clear today / before today / all deletes those signal rows.",
          "Kite remains the broker's execution reality. Reconcile with broker compares the ledger to Kite and records mismatches instead of silently rewriting history. Square off on a position row (or on Today / Chase) sends a flatten for the open book. Clear phantom zeros a leftover ledger book after proving Kite is flat (or immediately for paper). It does not send an order and does not let you type a new qty.",
          "A signal is not an order. An order is not a fill. A fill is not a position. A position is not a completed trade. Desk keeps those records separate so a restart can reconstruct what happened.",
          "Desk → Risk is the only place trading limits live. Strategies do not share P&L for those limits. See Risk flags below for Allow live orders vs Trading enabled, and Strategy enabled vs Not halted. The Risk page also lists Chase and today's weekday-plan size next to max notional so a 2-lot Nifty future is not a surprise at punch.",
        ],
      },
      {
        id: "risk-flags",
        title: "Risk flags — live, trading, enabled, halt",
        body: [
          "Allow live orders is the Zerodha master switch. Off means paper and mock still work (quotes and the ledger). A live punch also needs MOCK_ORDERS=false in .env and that strategy's Execution set to Live. Squaring off an existing live book is still allowed so you can get out.",
          "Trading enabled is desk-wide new entries. Turn it off to stop straddles, strangles, and Chase from opening. Flatten and stop-loss still go through. Halt new entries on the desk header is the same idea with a stored reason; Resume is explicit and also turns trading back on.",
          "Strategy enabled is that book's on/off. Off rejects every order for that strategy, including stop-loss and flatten. Use this when you want that book completely dark.",
          "Not halted only blocks new entries (you halt it from Risk, or Kill desk). Flatten and stop-loss still work. Halt never auto-clears — uncheck Not halted, or Resume on the desk header for a desk-wide halt. Max lots and max open positions stay per strategy so a new entry is sized and not stacked on an existing book. Paper → Live archives that strategy’s paper trial (no Kite order) and resets Chase to AWAITING_SIGNAL. Save is rejected if Kite or the live ledger still has size. Live flatten never uses paper qty. Live → Paper is rejected while a live book is open. If a live ledger row is leftover and the broker is flat, Desk → Positions → Clear phantom zeros the app row without sending a Kite order.",
        ],
      },
      {
        id: "plan",
        title: "Trade plan vs punch now",
        body: [
          "Trade plan stores weekday templates. Dashboard → Today's plan turns today's weekday into live jobs.",
          "Straddle / Strangle in the sidebar are for punching (or scheduling) right now, without waiting for the weekday template.",
          "Dashboard Today has Square off on each active job, including Chase, plus Square off all open. Those flatten the current books without halting. Kill intraday is the emergency: flatten today's straddles and strangles and halt the desk. Kill all also pauses Chase. Chase is often a hedge for long ETFs — use Kill all only when you mean it.",
        ],
      },
    ],
  },
  plan: {
    title: "Weekday templates",
    summary:
      "One saved configuration per strategy per weekday. Browse by day or by strategy. Edit inline.",
    sections: [
      {
        id: "one",
        title: "One template per strategy per day",
        body: [
          "Monday Straddle is a single row. If a template already exists, use Edit — Add stays hidden.",
          "Copy to other days writes that saved row onto the other weekdays (creates or replaces).",
          "Reset to default reloads the master defaults from the database (seeded on first migrate, editable via Save as defaults).",
        ],
      },
      {
        id: "name-vs-index",
        title: "Template name vs index",
        body: [
          "Template name is only a label in the list.",
          "Index (Nifty / BankNifty / FinNifty) is what is actually traded. On the plan, pick exactly one index. On punch-now pages you may tick several; each tick is a separate order.",
        ],
      },
    ],
  },
  straddle: {
    title: "ATM straddle",
    summary:
      "Sell (or buy) the at-the-money call and put together. Starts delta-neutral. Same session; 9:20-style per-leg stops.",
    sections: [
      {
        id: "contract",
        title: "Contract",
        body: [
          "Template name: label only.",
          "Index: the option chain to use. Lot size on NSE is taken from the live contract when possible.",
          "Volatility type: short = sell both legs; long = buy both legs.",
          "Product: MIS is intraday; NRML carries overnight (unusual for this structure here).",
          "Expiry: current or next monthly/weekly (weekly UI is Nifty only).",
          "Lots: number of option lots per leg. The form shows quantity and, if you type an estimated premium, rupee notional vs Desk → Risk max notional.",
        ],
      },
      {
        id: "entry",
        title: "Entry / skew",
        body: [
          "ATM call and put premiums are rarely equal. Skew is the gap between those two prices.",
          "Ideal skew %: wait until the gap is this small (or smaller) before entering.",
          "Threshold skew %: if time is running out, accept a worse gap down to this floor.",
          "Skew checker minutes: how long to keep waiting.",
          "If skew never converges: either reject the trade or enter anyway.",
        ],
      },
      {
        id: "risk",
        title: "Risk",
        body: [
          "This is the classic 9:20 short straddle: sell ATM CE and PE together (delta-neutral at entry). Each leg has its own stop as a percent of that fill. Combined, Supertrend, and OBS trail exits are not available.",
          "When Nifty trends one way, only the losing wing's SL should hit. The other wing stays open on purpose until auto square-off — that leftover is a directional hold until EOD, not a naked miss.",
          "Chop that tags both stops is the contained worst case (two SL hits). True leftover risk is a one-legged fill (rollback) or a gap through the stop, not the trend leftover.",
          "No SL: time square-off only. Auto square-off must be on.",
          "Hedge: optional far OTM long options to cap tail risk.",
          "Max loss / max profit (points): strategy-level exits in option points, not rupees. The dashboard still shows rupee P&L separately.",
          "Trail-up %: after max profit is hit, the target can be raised by this percent.",
        ],
      },
      {
        id: "timing",
        title: "Timing",
        body: [
          "Schedule run: when the weekday job (or punch-now job) should start looking for entry. Classic 9:20 uses ~09:20 IST; the same per-leg exits apply at any run time.",
          "Auto square off: flatten whatever is still open at this clock time (Asia/Kolkata), including a leftover wing after one SL. Default is 15:20.",
          "Rollback: what to do if a hedge, primary, or exit order breaks. That is the real naked-short case (one leg filled, the other not).",
        ],
      },
    ],
  },
  strangle: {
    title: "Strangle",
    summary:
      "Call and put struck away from spot. Same 9:20 per-leg stops as the ATM straddle, with a wider break-even.",
    sections: [
      {
        id: "contract",
        title: "Contract",
        body: [
          "Same name vs index split as the straddle: name is a label; index is the chain.",
          "Inverted strangle: swaps the usual OTM wings (used when you want the opposite skew treatment).",
          "Lots: same as the straddle — the form previews quantity and notional vs the Desk cap if you type an estimated premium.",
        ],
      },
      {
        id: "entry",
        title: "Entry",
        body: [
          "Distance from ATM: number of strikes away from the ATM strike (1 = first OTM each side).",
          "Percent from ATM: strike chosen by % distance from spot.",
          "Option price: pick wings whose premium is near this rupee value.",
        ],
      },
      {
        id: "risk",
        title: "Risk",
        body: [
          "Same 9:20 exits as the straddle: each wing has its own SL %. A one-way Nifty day stops the losing wing only; the other stays until auto square-off. That leftover is intended.",
          "No SL is allowed only with auto square-off. Combined, Supertrend, and OBS trail exits are not available.",
        ],
      },
      {
        id: "timing",
        title: "Timing",
        body: [
          "Same-session schedule and square-off. A leftover option wing after one SL is held only until auto square-off, not overnight. This is not Chase.",
        ],
      },
    ],
  },
  chase: {
    title: "Chase",
    summary:
      "Futures trend-follow around a long EMA. Add an NFO underlying (index or stock) from the Chase page. Positions can stay open across sessions.",
    sections: [
      {
        id: "instruments",
        title: "Underlyings",
        body: [
          "Each underlying has its own status, signals, EMA series, and futures contract. Search adds a Kite NFO name such as RELIANCE or INFY. The front-month future is chosen when the job runs. A new book is saved with Trade this book off.",
          "Off and flat means no hourly candles and no signals. The minute job still runs when that book is LONG, SHORT, or waiting on an entry. The NFO instrument list is one cached download, not a Kite call per symbol.",
        ],
      },
      {
        id: "trade-this-index",
        title: "Trade this book vs Pause entries",
        body: [
          "Trade this book (the switch) is whether this underlying is in the Chase engine. Off skips hourly EMA and new signals for that book. Pause is disabled until you turn it back on. If the book is already LONG, SHORT, or AWAITING_*, the minute job still trails, stops, and flattens — you are not left without a stop.",
          "Pause entries (the button) is lighter. The book stays on, so EMA still updates. It blocks new entries only, cancels a pending AWAITING_LONG/SHORT trigger, and returns to AWAITING_SIGNAL. An open LONG/SHORT keeps its protective stop until flat; after that it will not re-enter until you Resume entries.",
          "Neither control flattens, neither sets Desk halt, neither stops straddles. Kill all sets Pause on every Chase index. Kill intraday does not. Square off all Chase books flattens without pausing — the next hourly job can signal again. Desk → Risk Strategy enabled for Chase is a third switch: off rejects every Chase order including flatten.",
        ],
      },
      {
        id: "lots",
        title: "Lots",
        body: [
          "How many futures lots to trade on that index. Lots are independent (Nifty can be 1 while BankNifty is 2). The page shows lots × lot size × last hourly close so you can see rupee notional before an order. Desk → Risk max notional and Chase max lots still apply to the whole Chase strategy.",
          "Reset to fresh signal on Chase is per index. Desk → Risk “Reset Chase to fresh signal” resets every Chase index together. Neither flatten an open futures book — use Square off on Chase, Today, or Desk → Positions.",
        ],
      },
      {
        id: "ema",
        title: "EMA period",
        body: [
          "Length of the exponential moving average on hourly typical price (H+L+C)/3. Shipped value is 40. Each enabled index uses its own period and stores its own EMA rows.",
          "A longer period is slower and filters noise; a shorter period turns more often.",
          "If an hourly EMA job was missed, the next hour continues from the last stored EMA rather than rebuilding from history. Desk shows CHASE_EMA_GAP. New entries that hour still run.",
        ],
      },
      {
        id: "buffer",
        title: "Buffer %",
        body: [
          "Close must be this percent above the EMA for a long setup, or this percent below for a short setup. Shipped value is 0.2 (that is 1.002× / 0.998× EMA).",
          "A larger buffer means fewer signals and more confirmation. Too large and the move is already gone.",
        ],
      },
      {
        id: "offset",
        title: "Entry limit offset",
        body: [
          "When the trigger is not yet traded, the desk places an SL order. The limit price is trigger plus this many rupees on buys, minus on sells. Shipped value is 5.",
          "This is not the strategy stop. The strategy stop is the EMA / day high-low logic in the Chase worker.",
        ],
      },
      {
        id: "open-classify",
        title: "09:16 morning classify",
        body: [
          "Default is PDF: at 09:16 IST, compare the 09:16 candle close (2-minute, or 1-minute if that is missing) to the overnight hourly EMA. Day's high/low till 09:16 come from those session bars. T+1 still uses the four T1 buckets; later days still trail the stop to EMA.",
          "Legacy is the older 60-minute bar that also steps 40-EMA on that stub hour. Keep it only to compare against the legacy 60-minute Anil port.",
        ],
      },
    ],
  },
  momentum: {
    title: "Cash momentum",
    summary:
      "A long-only list of NSE shares. The page ranks about 750 names and shows what it would buy and sell. It sends nothing until you change Execution.",
    sections: [
      {
        id: "what",
        title: "What this page is",
        body: [
          "Momentum keeps a stored list of NSE cash names and ranks them from daily prices. Rank 1 is the strongest score. Filters do not reshuffle that order. A name that fails a filter keeps its rank and is simply skipped for a new buy.",
          "The book is long only. It buys shares and later sells shares it already holds. It does not short. Today’s unfinished daily candle is ignored. The rank uses the last completed close.",
          "Strategy on, on this page, turns the rank and the history download on. Desk → Risk is a second switch. Both have to allow Momentum before a live order can go out. Report only never sends an order.",
        ],
      },
      {
        id: "fields",
        title: "Fields on the page",
        body: [
          "Strategy on: the rank and Pull history now work. Off leaves the name list visible and does not download or rank.",
          "Pull data daily: the hourly check may download each name once per day. Off skips that automatic download. Pull history now still works when Strategy on is saved.",
          "Execution: Report only shows the buy and sell list. Manual sends only when you click Send rebalance. Auto sends on the rebalance day, once that day, without the click.",
          "Rebalance: Monthly uses the first NSE session of the month. Weekly uses the weekday below (1 is Monday, 5 is Friday). Ad hoc never sends by itself. The buy and sell list is still calculated. You preview it, then click Send when you want it.",
          "Holdings: how many names the book wants to own. Default 30. This is a cap, not a pile of extra slots.",
          "Worst rank held: a share you already own may stay while its rank is this number or better. Default 75. Rank 80 is worse than 75, so that name is sold. A lower number here sells sooner.",
          "Entry rank max: a new name may be bought only if its rank is this number or better. Default 75. This does not raise the number of names. Holdings still caps the book.",
          "Rank: 12-month Sharpe is the default. The other choices are 12-month return, and 12-month return that skips the last month.",
          "Max weight %: no name is given more than this share of the book. Default 10%. The equal slice is 100 divided by Holdings, then cut down to this cap.",
          "Capital INR: rupees for the whole book, not per share. Quantity is the rupees for that name divided by the last completed close, rounded down to whole shares. 0 shows weights and buys nothing.",
        ],
      },
      {
        id: "slots",
        title: "A name that stays, and a new name",
        body: [
          "If a share stays because its rank is still inside worst rank held, it keeps its slot. A new name is bought only when a slot is free: someone was sold, excluded, or you hold fewer names than Holdings.",
          "You do not add a second capital budget so the old name and the new name can sit together past that cap. The same Capital INR is split across the names in the book. When the book is already full and nobody is leaving, the new name waits.",
        ],
      },
      {
        id: "filters",
        title: "Filters",
        body: [
          "Open Filters to change the gates. A new buy has to pass all of them. Defaults: price has not multiplied by more than 10 in 12 months or in 24 months, close is within 25% of the stored high, average turnover over 21 sessions is at least ₹1 crore, close is above the 200-session average, the last month is not most of a positive 12-month move, and the 12-month return is positive.",
          "Market cap Off ignores market cap. Strict drops a name with no stored market cap, or one below the minimum. The daily market-cap refresh covers the daily-trend list, not all 750 momentum names.",
          "Turnover is the average of close times volume over the last 21 stored sessions. It appears after a history pull. There is no circuit-count filter.",
        ],
      },
      {
        id: "buttons",
        title: "Buttons",
        body: [
          "Save writes Strategy on, Pull data daily, execution, rebalance, holdings, ranks, weights, capital, and filters. Until you save, those edits sit on the form only. Save then ranks the stored names again, which is why the spinner stays up. It does not download from Zerodha.",
          "Pull history now writes those same switches, then starts the download and returns at once. You can leave the page. The download keeps going, and the bar comes back when you return. It needs Strategy on. One name is requested at a time.",
          "Preview orders rebuilds the buy and sell list from the stored candles and the last saved settings. It does not place an order. An unsaved edit on the form is ignored until you Save.",
          "Send rebalance places that list. The button stays off while Execution is Report only. Manual sends on the click. Auto also sends on the rebalance day without the click. The success message means the click was accepted. Check Desk → Orders and Alerts for a rejection.",
          "In the table, Hold keeps that name at its current weight. Later rebalances do not buy more shares to lift it up to an equal slice. Exclude sells the shares you hold and does not buy that name again. Clear the lock by clicking the lock name. Hold and Exclude save immediately. They do not need the Save button.",
        ],
      },
      {
        id: "table",
        title: "The table",
        body: [
          "All names shows the ranked list. Pass the filters shows names that clear the gates. In the order diff shows the target book plus any name that is only being sold. That view can be one larger than Holdings. The extra row is a name leaving so the book can come back to the cap. It is not an extra holding.",
          "Export this view downloads the rows you are looking at. Sorting a column does not need Save.",
        ],
      },
    ],
  },
}

export const HELP_TOPICS = Object.keys(HELP_PAGES) as HelpTopic[]
