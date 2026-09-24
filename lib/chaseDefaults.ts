export const CHASE_OPEN_CLASSIFY = {
  PDF_0916: "pdf_0916",
  LEGACY_60M: "legacy_60m",
} as const

export type ChaseOpenClassify = (typeof CHASE_OPEN_CLASSIFY)[keyof typeof CHASE_OPEN_CLASSIFY]

export type ChaseEngineConfig = {
  lots: number
  emaPeriod: number
  bufferPercent: number
  entryLimitOffset: number
  /**
   * Percent away from the last price used as the limit on a Chase market order.
   * A sell floor of 2% sat outside the exchange band; 1.5% stays inside it.
   */
  marketProtectionPercent: number
  paused: boolean
  instruments: string[]
  /** How 09:16 T+1 / later-day SL reads close, EMA, and day's H/L. */
  openClassify: ChaseOpenClassify
}

/** One Chase engine book. Lots / buffer / pause are per index. */
export type ChaseBookConfig = ChaseEngineConfig & {
  instrument: string
  enabled: boolean
}

export const CHASE_MASTER_DEFAULTS: ChaseEngineConfig = {
  lots: 1,
  emaPeriod: 40,
  bufferPercent: 0.2,
  entryLimitOffset: 5,
  marketProtectionPercent: 1.5,
  paused: false,
  instruments: ["NIFTY"],
  openClassify: CHASE_OPEN_CLASSIFY.PDF_0916,
}

export const CHASE_INDEX_ORDER = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"] as const

export function defaultChaseBook(instrument: string, enabled = false): ChaseBookConfig {
  return {
    ...CHASE_MASTER_DEFAULTS,
    instrument,
    enabled,
    instruments: enabled ? [instrument] : [],
    paused: !enabled,
  }
}

export function aggregateChaseConfig(books: ChaseBookConfig[]): ChaseEngineConfig {
  const enabled = books.filter(book => book.enabled)
  const primary = enabled[0] ?? books.find(book => book.instrument === "NIFTY") ?? books[0]
  return {
    lots: primary?.lots ?? CHASE_MASTER_DEFAULTS.lots,
    emaPeriod: primary?.emaPeriod ?? CHASE_MASTER_DEFAULTS.emaPeriod,
    bufferPercent: primary?.bufferPercent ?? CHASE_MASTER_DEFAULTS.bufferPercent,
    entryLimitOffset: primary?.entryLimitOffset ?? CHASE_MASTER_DEFAULTS.entryLimitOffset,
    marketProtectionPercent:
      primary?.marketProtectionPercent ?? CHASE_MASTER_DEFAULTS.marketProtectionPercent,
    paused: enabled.length ? enabled.every(book => book.paused) : true,
    instruments: enabled.map(book => book.instrument),
    openClassify: primary?.openClassify ?? CHASE_MASTER_DEFAULTS.openClassify,
  }
}

export const CHASE_MARKET_PROTECTION_MIN = 0.25
export const CHASE_MARKET_PROTECTION_MAX = 5

/** Clamp a Chase market-protection percent. Missing values become 1.5. */
export function normalizeChaseMarketProtection(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return CHASE_MASTER_DEFAULTS.marketProtectionPercent
  const clamped = Math.min(CHASE_MARKET_PROTECTION_MAX, Math.max(CHASE_MARKET_PROTECTION_MIN, n))
  return Math.round(clamped * 100) / 100
}

/**
 * Limit price Kite sends for a market order with this protection percent.
 * A sell limit is below the last price. A buy limit is above it.
 */
export function chaseMarketProtectionPrice(
  ltp: number,
  side: "BUY" | "SELL",
  percent: number
): number {
  const fraction = normalizeChaseMarketProtection(percent) / 100
  return side === "SELL" ? ltp * (1 - fraction) : ltp * (1 + fraction)
}

export function chaseTolerances(ema: number, bufferPercent: number) {
  const fraction = bufferPercent / 100
  return {
    longTolerance: ema * (1 + fraction),
    shortTolerance: ema * (1 - fraction),
  }
}

const OPEN_POSITION = new Set(["LONG", "SHORT"])

/** When paused, do not open a new Chase futures position. */
export function chaseAllowsNewEntry(paused: boolean): boolean {
  return !paused
}

/** Open LONG/SHORT (and their stops) keep running until the position is flat. */
export function chaseManagesOpenPosition(
  paused: boolean,
  status: string | null | undefined
): boolean {
  return OPEN_POSITION.has(status ?? "")
}
