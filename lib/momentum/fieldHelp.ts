/** Tooltip copy for Momentum Run & filters (ℹ on the label). */
export const MOMENTUM_FIELD_HELP = {
  engine:
    "When on, the stored universe is ranked from daily candles and the hourly job may pull history (if Pull data daily is on). Off leaves the list visible without ranking.",
  dataRefresh:
    "Once per IST day while Engine is on, download missing daily candles from Kite. Off skips automatic pull; Pull history now still works.",
  execution:
    "Report only shows orders and sends nothing. Manual sends on Send rebalance. Auto sends once on the rebalance day during the session. The menu is not live until Save. Send follows the saved value.",
  rebalance:
    "Monthly: first NSE session of the month. Weekly: the weekday below. Ad hoc: never auto-sends; you preview and send manually.",
  weeklyDay: "1 = Monday through 5 = Friday. Used only when Rebalance is Weekly.",
  capitalInr:
    "Rupees for the whole book, not per share. Zero shows weights and places no buys. In let winners run, spare cash can be deployed without a full rebalance.",
  holdings:
    "Target number of names in the book (default 30). A full book waits for a slot before buying a new name.",
  worstRankHeld:
    "An existing holding may stay while its rank is this good or better (lower number = stronger). Worse rank triggers a sell on rebalance.",
  entryRankMax:
    "A new name is bought only if its rank is at least this good. Does not raise Holdings; you still need a free slot.",
  ranking: "Score used to sort the universe. Filters do not re-rank; they only gate new buys.",
  weighting:
    "Equal weight resizes every name each rebalance. Let winners run keeps shares until the name leaves the book or hits trim rules.",
  maxWeightPct: "Equal weight: cap per name. Let winners run: cap only when opening a new name.",
  trimAbovePct:
    "Let winners run: when one name exceeds this % of book value (vs capital or holdings), trim it down.",
  trimToPct:
    "Sell down to this % of book after trim fires. New cash buys new names, not top-ups to winners.",
  maxPriceMultiple12m:
    "Reject new buys when price has risen more than this multiple over 12 months.",
  maxPriceMultiple24m: "Same gate over 24 months of history.",
  maxPctBelowHigh: "Reject when close is farther than this % below the stored high.",
  minAvgTurnoverInr: "Mean of close × volume over the last 21 sessions after a history pull.",
  smaPeriod: "Close must be above this many sessions of simple moving average.",
  maxOneMonthShare:
    "When 12-month return is positive, reject if the last month contributed too large a share of that move.",
  marketCapFilter:
    "Off ignores market cap. Strict drops names with no stored cap or below minimum. Refresh covers daily-trend names, not all 750.",
  deploySpare:
    "Let winners run only. Splits spare rupees across today's book up to max weight and trim-down levels. Does not replace the ranked rebalance list.",
  trimBook:
    "Let winners run only. Sells the same fraction of every open line so weights stay proportional. Capital INR drops by that fraction only when every sell is accepted.",
  trimPct: "Percent of each open position to sell on Trim book (preview uses this value).",
  filterSymbol: "Narrows the rank table on this page only. Does not change the stored rank.",
  showView:
    "Filter the table. Pass the filters hides names that failed, including a holding that will be sold. Export uses this view.",
} as const
