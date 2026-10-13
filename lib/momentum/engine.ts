import type { MomentumConfig, MomentumExecution } from "./types"

export type DailyBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const SESSIONS_1M = 21
export const SESSIONS_12M = 252
export const SESSIONS_24M = 504

export type MomentumMetrics = {
  score: number | null
  roc12: number | null
  roc24: number | null
  roc1: number | null
  pctBelowHigh: number | null
  aboveSma: boolean | null
  avgTurnoverInr: number | null
  circuitCount12m: number | null
  marketCapCr: number | null
}

export type MomentumSymbol = {
  symbol: string
  bars?: DailyBar[]
  metrics?: Partial<MomentumMetrics>
  marketCapCr?: number | null
  circuitCount12m?: number | null
  price?: number | null
}

export type RankedSymbol = {
  symbol: string
  rank: number | null
  price: number | null
  metrics: MomentumMetrics
  filterPass: boolean
  filterReasons: string[]
}

export type HoldingQty = { symbol: string; quantity: number }
export type WeightLock = {
  symbol: string
  mode: "HOLD_WEIGHT" | "EXCLUDE"
  weightPct: number
}

export type PlannedOrder = {
  symbol: string
  side: "BUY" | "SELL"
  quantity: number
  role: "ENTRY" | "EXIT"
  limitPrice: number | null
  reason: string
}

export type TargetLine = {
  symbol: string
  rank: number | null
  weightPct: number
  targetQty: number
  heldQty: number
  locked: boolean
}

export type MomentumPlan = {
  ranked: RankedSymbol[]
  targets: TargetLine[]
  orders: PlannedOrder[]
}

function sortedBars(bars: DailyBar[] | undefined, asOf?: string): DailyBar[] {
  if (!bars?.length) return []
  return bars
    .filter(bar => !asOf || bar.date <= asOf)
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
}

function rocOver(closes: number[], sessions: number): number | null {
  if (closes.length <= sessions) return null
  const then = closes[closes.length - 1 - sessions]
  const now = closes[closes.length - 1]
  if (!(then > 0) || !(now > 0)) return null
  return now / then - 1
}

function returnSkipLastMonth(closes: number[]): number | null {
  if (closes.length <= SESSIONS_1M + SESSIONS_12M) return null
  const end = closes[closes.length - 1 - SESSIONS_1M]
  const start = closes[closes.length - 1 - SESSIONS_1M - SESSIONS_12M]
  if (!(start > 0) || !(end > 0)) return null
  return end / start - 1
}

function sharpe(closes: number[]): number | null {
  if (closes.length <= SESSIONS_12M) return null
  const window = closes.slice(closes.length - SESSIONS_12M - 1)
  const rets: number[] = []
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1]
    if (!(prev > 0)) return null
    rets.push(window[i] / prev - 1)
  }
  const mean = rets.reduce((sum, value) => sum + value, 0) / rets.length
  const variance =
    rets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, rets.length - 1)
  const sd = Math.sqrt(variance)
  if (!(sd > 0)) return null
  return (mean / sd) * Math.sqrt(252)
}

export function metricsFromBars(
  bars: DailyBar[] | undefined,
  ranking: MomentumConfig["ranking"],
  smaPeriod: number,
  asOf?: string
): MomentumMetrics {
  const history = sortedBars(bars, asOf)
  const closes = history.map(bar => bar.close)
  const roc12 = rocOver(closes, SESSIONS_12M)
  const roc24 = rocOver(closes, SESSIONS_24M)
  const roc1 = rocOver(closes, SESSIONS_1M)
  const score =
    ranking === "RETURN_12M"
      ? roc12
      : ranking === "RETURN_12_1"
        ? returnSkipLastMonth(closes)
        : sharpe(closes)
  const high = history.reduce((max, bar) => Math.max(max, bar.high), 0)
  const last = closes[closes.length - 1]
  const pctBelowHigh = high > 0 && last > 0 ? ((high - last) / high) * 100 : null
  const smaWindow = closes.slice(-smaPeriod)
  const sma =
    smaWindow.length >= smaPeriod
      ? smaWindow.reduce((sum, value) => sum + value, 0) / smaPeriod
      : null
  const turnoverWindow = history.slice(-SESSIONS_1M)
  const avgTurnoverInr = turnoverWindow.length
    ? turnoverWindow.reduce((sum, bar) => sum + bar.close * Math.max(0, bar.volume), 0) /
      turnoverWindow.length
    : null
  return {
    score,
    roc12,
    roc24,
    roc1,
    pctBelowHigh,
    aboveSma: sma != null && last != null ? last > sma : null,
    avgTurnoverInr,
    circuitCount12m: null,
    marketCapCr: null,
  }
}

function mergeMetrics(
  symbol: MomentumSymbol,
  config: MomentumConfig,
  asOf?: string
): MomentumMetrics {
  const computed = symbol.bars
    ? metricsFromBars(symbol.bars, config.ranking, config.filters.smaPeriod, asOf)
    : {
        score: null,
        roc12: null,
        roc24: null,
        roc1: null,
        pctBelowHigh: null,
        aboveSma: null,
        avgTurnoverInr: null,
        circuitCount12m: null,
        marketCapCr: null,
      }
  return {
    ...computed,
    ...symbol.metrics,
    circuitCount12m:
      symbol.circuitCount12m ?? symbol.metrics?.circuitCount12m ?? computed.circuitCount12m,
    marketCapCr: symbol.marketCapCr ?? symbol.metrics?.marketCapCr ?? computed.marketCapCr,
  }
}

export function filterReasons(metrics: MomentumMetrics, config: MomentumConfig): string[] {
  const reasons: string[] = []
  const filters = config.filters
  if (metrics.score == null) reasons.push("no rank score")
  if (metrics.roc12 == null) reasons.push("12-month history missing")
  else if (1 + metrics.roc12 >= filters.maxPriceMultiple12m)
    reasons.push("12-month move over the multiple cap")
  if (metrics.roc24 == null) reasons.push("24-month history missing")
  else if (1 + metrics.roc24 >= filters.maxPriceMultiple24m)
    reasons.push("24-month move over the multiple cap")
  if (metrics.pctBelowHigh == null) reasons.push("high missing")
  else if (metrics.pctBelowHigh > filters.maxPctBelowHigh)
    reasons.push("too far below the stored high")
  if (metrics.avgTurnoverInr == null) reasons.push("turnover missing")
  else if (metrics.avgTurnoverInr < filters.minAvgTurnoverInr)
    reasons.push("average turnover below the floor")
  if (filters.marketCapFilter === "strict") {
    if (metrics.marketCapCr == null) reasons.push("market cap unavailable")
    else if (metrics.marketCapCr < filters.minMarketCapCr)
      reasons.push("market cap below the floor")
  }
  if (filters.requireAboveSma) {
    if (metrics.aboveSma == null) reasons.push("average missing")
    else if (!metrics.aboveSma) reasons.push("below the moving average")
  }
  if (filters.requirePositive12m && !(metrics.roc12 != null && metrics.roc12 > 0)) {
    reasons.push("12-month return is not positive")
  }
  if (metrics.roc12 != null && metrics.roc12 > 0) {
    if (metrics.roc1 == null) reasons.push("1-month return missing")
    else if (metrics.roc1 / metrics.roc12 >= filters.maxOneMonthShare) {
      reasons.push("last month is too large a share of the 12-month move")
    }
  }
  return reasons
}

export function rankSymbols(
  symbols: MomentumSymbol[],
  config: MomentumConfig,
  asOf?: string
): RankedSymbol[] {
  const scored = symbols.map(symbol => {
    const metrics = mergeMetrics(symbol, config, asOf)
    const price = symbol.price ?? sortedBars(symbol.bars, asOf).at(-1)?.close ?? null
    const filterReasonsFor = filterReasons(metrics, config)
    return {
      symbol: symbol.symbol,
      rank: null as number | null,
      price,
      metrics,
      filterPass: filterReasonsFor.length === 0,
      filterReasons: filterReasonsFor,
    }
  })
  const order = scored
    .filter(row => row.metrics.score != null)
    .slice()
    .sort((a, b) => {
      const diff = (b.metrics.score ?? 0) - (a.metrics.score ?? 0)
      if (diff !== 0) return diff
      return a.symbol.localeCompare(b.symbol)
    })
  order.forEach((row, index) => {
    row.rank = index + 1
  })
  return scored.sort((a, b) => {
    if (a.rank == null && b.rank == null) return a.symbol.localeCompare(b.symbol)
    if (a.rank == null) return 1
    if (b.rank == null) return -1
    return a.rank - b.rank
  })
}

function limitPrice(
  side: "BUY" | "SELL",
  price: number | null,
  bufferPercent: number
): number | null {
  if (price == null || !(price > 0)) return null
  const buffer = bufferPercent / 100
  const raw = side === "BUY" ? price * (1 + buffer) : price * (1 - buffer)
  return Math.round(raw * 20) / 20
}

export function buildMomentumPlan(args: {
  symbols: MomentumSymbol[]
  config: MomentumConfig
  holdings: HoldingQty[]
  locks: WeightLock[]
  asOf?: string
}): MomentumPlan {
  const ranked = rankSymbols(args.symbols, args.config, args.asOf)
  const bySymbol = new Map(ranked.map(row => [row.symbol, row]))
  const held = new Map(
    args.holdings.filter(row => row.quantity > 0).map(row => [row.symbol, row.quantity])
  )
  const locks = new Map(args.locks.map(lock => [lock.symbol, lock]))
  const excluded = (symbol: string) => locks.get(symbol)?.mode === "EXCLUDE"

  const kept = [...held.keys()].filter(symbol => {
    if (excluded(symbol)) return false
    const row = bySymbol.get(symbol)
    if (!row || row.rank == null) return false
    if (row.rank > args.config.worstRankHeld) return false
    if (args.config.exitWhenFilterBreaks && !row.filterPass) return false
    return true
  })
  const keptSet = new Set(kept)
  const entrants = ranked
    .filter(
      row =>
        row.filterPass &&
        row.rank != null &&
        row.rank <= args.config.entryRankMax &&
        !excluded(row.symbol) &&
        !keptSet.has(row.symbol)
    )
    .slice(0, Math.max(0, args.config.holdingsCount - kept.length))
  const targetSymbols = [...kept, ...entrants.map(row => row.symbol)].slice(
    0,
    args.config.holdingsCount
  )

  const slot = 100 / args.config.holdingsCount
  const draft = targetSymbols.map(symbol => {
    const lock = locks.get(symbol)
    const locked = lock?.mode === "HOLD_WEIGHT" && (held.get(symbol) ?? 0) > 0
    const weightPct = locked
      ? Math.max(0, lock?.weightPct ?? 0)
      : Math.min(slot, args.config.maxWeightPct)
    return { symbol, weightPct, locked }
  })
  const lockedWeight = draft.filter(row => row.locked).reduce((sum, row) => sum + row.weightPct, 0)
  const unlocked = draft.filter(row => !row.locked)
  const unlockedWeight = unlocked.reduce((sum, row) => sum + row.weightPct, 0)
  const room = Math.max(0, 100 - lockedWeight)
  const scale = unlockedWeight > room && unlockedWeight > 0 ? room / unlockedWeight : 1
  for (const row of unlocked) row.weightPct = row.weightPct * scale

  const targets: TargetLine[] = draft.map(row => {
    const heldQty = held.get(row.symbol) ?? 0
    const price = bySymbol.get(row.symbol)?.price ?? null
    const sized =
      price != null && price > 0
        ? Math.floor((args.config.capitalInr * row.weightPct) / 100 / price)
        : 0
    const targetQty = row.locked ? Math.min(heldQty, sized) : sized
    return {
      symbol: row.symbol,
      rank: bySymbol.get(row.symbol)?.rank ?? null,
      weightPct: row.weightPct,
      targetQty,
      heldQty,
      locked: row.locked,
    }
  })
  const targetQty = new Map(targets.map(row => [row.symbol, row.targetQty]))

  const orders: PlannedOrder[] = []
  const symbols = new Set<string>([...held.keys(), ...targetQty.keys()])
  for (const symbol of symbols) {
    const have = held.get(symbol) ?? 0
    const want = targetQty.get(symbol) ?? 0
    const price = bySymbol.get(symbol)?.price ?? null
    if (have > want) {
      orders.push({
        symbol,
        side: "SELL",
        quantity: have - want,
        role: "EXIT",
        limitPrice: limitPrice("SELL", price, args.config.limitBufferPercent),
        reason: want === 0 ? "leave the book" : "weight above target",
      })
    } else if (want > have) {
      const lock = locks.get(symbol)
      if (lock?.mode === "HOLD_WEIGHT") continue
      orders.push({
        symbol,
        side: "BUY",
        quantity: want - have,
        role: "ENTRY",
        limitPrice: limitPrice("BUY", price, args.config.limitBufferPercent),
        reason: have === 0 ? "new holding" : "weight below target",
      })
    }
  }

  return {
    ranked,
    targets,
    orders: orders.filter(order => order.quantity > 0),
  }
}

export function executableOrders(
  plan: MomentumPlan,
  args: { execution: MomentumExecution; executeRequested: boolean; due: boolean }
): PlannedOrder[] {
  if (args.execution === "report") return []
  if (args.execution === "manual" && !args.executeRequested) return []
  if (args.execution === "auto" && !args.executeRequested && !args.due) return []
  return plan.orders
}
