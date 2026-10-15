export type RankingMethod = "SHARPE_12M" | "RETURN_12M" | "RETURN_12_1"
export type RebalanceFrequency = "monthly" | "weekly" | "adhoc"
export type MomentumExecution = "report" | "manual" | "auto"
/** equal pulls every name back to one slice. drift leaves shares alone until the name leaves the book. */
export type WeightingMode = "equal" | "drift"
export type LockMode = "HOLD_WEIGHT" | "EXCLUDE"
export type FilterMode = "off" | "strict"

export type MomentumFilters = {
  /** Price multiple cap. 10 means a 10× move fails. */
  maxPriceMultiple12m: number
  maxPriceMultiple24m: number
  /** Maximum percent below the stored high. 25 means the close must be within 25% of that high. */
  maxPctBelowHigh: number
  minAvgTurnoverInr: number
  circuitFilter: FilterMode
  maxCircuits12m: number
  marketCapFilter: FilterMode
  minMarketCapCr: number
  smaPeriod: number
  requireAboveSma: boolean
  /** Last-month return divided by 12-month return must stay under this. 0.5 is 50%. */
  maxOneMonthShare: number
  requirePositive12m: boolean
}

export type MomentumConfig = {
  /** Master switch. Off means no data pull and no ranking. */
  active: boolean
  /** Daily history pull. Ignored while active is off. */
  dataRefresh: boolean
  /** report calculates only. manual trades on an explicit click. auto trades on the rebalance day. */
  execution: MomentumExecution
  holdingsCount: number
  worstRankHeld: number
  entryRankMax: number
  rebalance: RebalanceFrequency
  /** 1 = Monday … 5 = Friday. Used when rebalance is weekly. */
  weeklyDay: number
  ranking: RankingMethod
  /** equal resizes every name to one slice. drift leaves held shares alone. */
  weighting: WeightingMode
  maxWeightPct: number
  minWeightPct: number
  /** In drift mode, a name at or above this share of the book is sold down to trimToPct. */
  trimAbovePct: number
  trimToPct: number
  capitalInr: number
  /** Buy limit sits this percent above the last price. Sell limit sits this percent below it. */
  limitBufferPercent: number
  /** A held name that fails a filter is a sell on the next rebalance pass. */
  exitWhenFilterBreaks: boolean
  filters: MomentumFilters
}

export const DEFAULT_MOMENTUM_FILTERS: MomentumFilters = {
  maxPriceMultiple12m: 10,
  maxPriceMultiple24m: 10,
  maxPctBelowHigh: 25,
  minAvgTurnoverInr: 10_000_000,
  circuitFilter: "off",
  maxCircuits12m: 25,
  marketCapFilter: "off",
  minMarketCapCr: 1000,
  smaPeriod: 200,
  requireAboveSma: true,
  maxOneMonthShare: 0.5,
  requirePositive12m: true,
}

export const DEFAULT_MOMENTUM_CONFIG: MomentumConfig = {
  active: false,
  dataRefresh: false,
  execution: "report",
  holdingsCount: 30,
  worstRankHeld: 75,
  entryRankMax: 75,
  rebalance: "monthly",
  weeklyDay: 1,
  ranking: "SHARPE_12M",
  weighting: "equal",
  maxWeightPct: 10,
  minWeightPct: 2,
  trimAbovePct: 20,
  trimToPct: 15,
  capitalInr: 0,
  limitBufferPercent: 0.15,
  exitWhenFilterBreaks: true,
  filters: { ...DEFAULT_MOMENTUM_FILTERS },
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function enumOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function normalizeMomentumConfig(raw: unknown): MomentumConfig {
  const row = raw && typeof raw === "object" ? (raw as Partial<MomentumConfig>) : {}
  const filters =
    row.filters && typeof row.filters === "object" ? row.filters : DEFAULT_MOMENTUM_FILTERS
  const holdingsCount = Math.round(num(row.holdingsCount, 30, 1, 100))
  const trimAbovePct = num(row.trimAbovePct, 20, 1, 100)
  const trimToPct = Math.min(num(row.trimToPct, 15, 0.1, 99), Math.max(0.1, trimAbovePct - 0.1))
  return {
    active: row.active === true,
    dataRefresh: row.dataRefresh === true,
    execution: enumOf(row.execution, ["report", "manual", "auto"] as const, "report"),
    holdingsCount,
    worstRankHeld: Math.round(num(row.worstRankHeld, 75, holdingsCount, 750)),
    entryRankMax: Math.round(num(row.entryRankMax, 75, 1, 750)),
    rebalance: enumOf(row.rebalance, ["monthly", "weekly", "adhoc"] as const, "monthly"),
    weeklyDay: Math.round(num(row.weeklyDay, 1, 1, 5)),
    ranking: enumOf(
      row.ranking,
      ["SHARPE_12M", "RETURN_12M", "RETURN_12_1"] as const,
      "SHARPE_12M"
    ),
    weighting: enumOf(row.weighting, ["equal", "drift"] as const, "equal"),
    maxWeightPct: num(row.maxWeightPct, 10, 0.1, 100),
    minWeightPct: num(row.minWeightPct, 2, 0, 100),
    trimAbovePct,
    trimToPct,
    capitalInr: num(row.capitalInr, 0, 0, 1_000_000_000),
    limitBufferPercent: num(row.limitBufferPercent, 0.15, 0, 5),
    exitWhenFilterBreaks: row.exitWhenFilterBreaks !== false,
    filters: {
      maxPriceMultiple12m: num(filters.maxPriceMultiple12m, 10, 1, 1000),
      maxPriceMultiple24m: num(filters.maxPriceMultiple24m, 10, 1, 1000),
      maxPctBelowHigh: num(filters.maxPctBelowHigh, 25, 0, 100),
      minAvgTurnoverInr: num(filters.minAvgTurnoverInr, 10_000_000, 0, 1e12),
      circuitFilter: "off",
      maxCircuits12m: Math.round(num(filters.maxCircuits12m, 25, 0, 250)),
      marketCapFilter: enumOf(filters.marketCapFilter, ["off", "strict"] as const, "off"),
      minMarketCapCr: num(filters.minMarketCapCr, 1000, 0, 1e9),
      smaPeriod: Math.round(num(filters.smaPeriod, 200, 2, 400)),
      requireAboveSma: filters.requireAboveSma !== false,
      maxOneMonthShare: num(filters.maxOneMonthShare, 0.5, 0, 10),
      requirePositive12m: filters.requirePositive12m !== false,
    },
  }
}

export function dataPullAllowed(config: MomentumConfig): boolean {
  return config.active && config.dataRefresh
}

export function rebalanceDue(
  config: MomentumConfig,
  ctx: { isoWeekday: number; firstSessionOfMonth: boolean }
): boolean {
  if (!config.active) return false
  if (config.rebalance === "adhoc") return false
  if (config.rebalance === "weekly") return ctx.isoWeekday === config.weeklyDay
  return ctx.firstSessionOfMonth
}

export function ordersAllowed(args: {
  execution: MomentumExecution
  executeRequested: boolean
  due: boolean
}): boolean {
  if (args.execution === "report") return false
  if (args.execution === "manual") return args.executeRequested
  return args.executeRequested || args.due
}
