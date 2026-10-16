export type TrendStatus = "FLAT" | "PENDING_LONG" | "LONG"
export type DailyEntryStyle = "CLOSE_CROSS" | "BREAK_HIGH"

export type DailyTrendConfig = {
  emaPeriod: number
  bufferPercent: number
  exitBufferPercent: number
  entryStyle: DailyEntryStyle
  quantity: number
}

export const DEFAULT_DAILY_TREND_CONFIG: DailyTrendConfig = {
  emaPeriod: 40,
  bufferPercent: 1,
  exitBufferPercent: 1,
  entryStyle: "CLOSE_CROSS",
  quantity: 1,
}

export type DailyDecision = {
  state: TrendStatus
  stop: number | null
  entry: number | null
  action: "NONE" | "BUY" | "SELL"
  quantity: number
  role: "ENTRY" | "SL" | "FLATTEN"
  reason: string
}

export function emaFromCloses(closes: number[], period: number): number | null {
  if (!Number.isInteger(period) || period < 1 || closes.length < period) return null
  let ema = 0
  for (let i = 0; i < period; i++) ema += closes[i]
  ema /= period
  const k = 2 / (period + 1)
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return ema
}

/** Bars dated today are still the session in progress, or a partial candle from the morning pull. */
export function completedDailyBars<T extends { date: string }>(bars: T[], today: string): T[] {
  return bars.filter(bar => bar.date < today)
}

/**
 * What a flat book would do on the last completed close. Same band as evaluateDailyLong.
 * A buy still needs the page switch on and execution off Report only.
 */
export function dailyTrendRowSignal(input: {
  close: number | null
  ema: number | null
  bufferPercent: number
  budgetInr: number
  entryStyle: DailyEntryStyle
}): { label: string; buy: boolean; qualifies: boolean } {
  if (input.close == null || input.ema == null || !(input.ema > 0) || !(input.close > 0)) {
    return { label: "No EMA", buy: false, qualifies: false }
  }
  const band = input.ema * (1 + input.bufferPercent / 100)
  if (!(input.close > band)) return { label: "Below the band", buy: false, qualifies: false }
  if (input.entryStyle === "BREAK_HIGH") {
    return { label: "Wait for the high", buy: false, qualifies: true }
  }
  const qty = sharesForBudget(input.budgetInr, input.close)
  if (!(qty > 0)) return { label: "Above the band, budget 0", buy: false, qualifies: true }
  return { label: `Buy ${qty}`, buy: true, qualifies: true }
}

/** Shares to buy from a rupee budget. Zero budget buys nothing. */
export function sharesForBudget(budgetInr: number, price: number): number {
  if (!(budgetInr > 0) || !(price > 0)) return 0
  return Math.floor(budgetInr / price)
}

export type DailyTrendBulkPatch = {
  emaPeriod?: number
  bufferPercent?: number
  exitBufferPercent?: number
  budgetInr?: number
  entryStyle?: "CLOSE_CROSS" | "BREAK_HIGH"
}

/** Fields the operator can stamp onto every book. Blank fields are left alone. */
export function parseDailyTrendBulkPatch(
  raw: unknown
): { ok: true; patch: DailyTrendBulkPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Nothing to apply" }
  const row = raw as Record<string, unknown>
  const patch: DailyTrendBulkPatch = {}
  if (row.emaPeriod != null && row.emaPeriod !== "") {
    const ema = Math.round(Number(row.emaPeriod))
    if (!Number.isFinite(ema) || ema < 2 || ema > 400)
      return { ok: false, error: "EMA must be between 2 and 400" }
    patch.emaPeriod = ema
  }
  if (row.bufferPercent != null && row.bufferPercent !== "") {
    const buffer = Number(row.bufferPercent)
    if (!Number.isFinite(buffer) || buffer < 0 || buffer > 20)
      return { ok: false, error: "Buffer % must be between 0 and 20" }
    patch.bufferPercent = buffer
  }
  if (row.exitBufferPercent != null && row.exitBufferPercent !== "") {
    const exitBuffer = Number(row.exitBufferPercent)
    if (!Number.isFinite(exitBuffer) || exitBuffer < 0 || exitBuffer > 20)
      return { ok: false, error: "Exit buffer % must be between 0 and 20" }
    patch.exitBufferPercent = exitBuffer
  }
  if (row.budgetInr != null && row.budgetInr !== "") {
    const budget = Number(row.budgetInr)
    if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000)
      return { ok: false, error: "Budget must be a rupee amount from 0 up" }
    patch.budgetInr = budget
  }
  if (row.entryStyle != null && row.entryStyle !== "") {
    if (row.entryStyle !== "CLOSE_CROSS" && row.entryStyle !== "BREAK_HIGH")
      return { ok: false, error: "Entry must be close cross or break high" }
    patch.entryStyle = row.entryStyle
  }
  if (!Object.keys(patch).length)
    return { ok: false, error: "Fill at least one field to apply to every symbol" }
  return { ok: true, patch }
}

/** Copies only the filled settings. On/off, pause, status, stop, and entry stay on the book. */
export function applyDailyTrendBulk<T extends DailyTrendBulkPatch>(
  book: T,
  patch: DailyTrendBulkPatch
): T {
  return { ...book, ...patch }
}

export function normalizeDailyTrendConfig(raw: unknown): DailyTrendConfig {
  const row = raw && typeof raw === "object" ? (raw as Partial<DailyTrendConfig>) : {}
  const quantity = Math.round(Number(row.quantity))
  const emaPeriod = Math.round(Number(row.emaPeriod))
  const buffer = Number(row.bufferPercent)
  const exitBuffer = Number(row.exitBufferPercent)
  return {
    emaPeriod: Number.isFinite(emaPeriod) ? Math.min(400, Math.max(2, emaPeriod)) : 40,
    bufferPercent: Number.isFinite(buffer) ? Math.min(20, Math.max(0, buffer)) : 1,
    exitBufferPercent: Number.isFinite(exitBuffer) ? Math.min(20, Math.max(0, exitBuffer)) : 1,
    entryStyle: row.entryStyle === "BREAK_HIGH" ? "BREAK_HIGH" : "CLOSE_CROSS",
    quantity: Number.isFinite(quantity) ? Math.min(1_000_000, Math.max(0, quantity)) : 1,
  }
}

/**
 * Long-only daily analogue of the Chase long side.
 * LONG is never returned unless the caller still has a long book; a flat book cannot sell.
 * Today's low is stored as the stop and is compared with a later close, because a daily
 * close cannot trade through that same bar's low.
 */
export function evaluateDailyLong(input: {
  ema: number
  bar: { high: number; low: number; close: number }
  state: TrendStatus
  bookQty: number
  stop: number | null
  entry: number | null
  config: DailyTrendConfig
}): DailyDecision {
  const { ema, bar, config } = input
  const longLine = ema * (1 + config.bufferPercent / 100)
  const exitLine = ema * (1 - config.exitBufferPercent / 100)
  const barStop = Math.min(ema, bar.low)
  const idle: DailyDecision = {
    state: "FLAT",
    stop: null,
    entry: null,
    action: "NONE",
    quantity: 0,
    role: "ENTRY",
    reason: "flat",
  }

  if (!(ema > 0) || !(bar.close > 0)) {
    return { ...idle, state: input.bookQty > 0 ? "LONG" : "FLAT", reason: "price missing" }
  }

  if (input.bookQty < 0) {
    return {
      state: "FLAT",
      stop: null,
      entry: null,
      action: "BUY",
      quantity: Math.abs(input.bookQty),
      role: "FLATTEN",
      reason: "long-only book flattens a short and does not add",
    }
  }

  if (input.bookQty > 0) {
    const stop = input.stop ?? barStop
    if (bar.close < stop || bar.close < exitLine) {
      return {
        state: "LONG",
        stop,
        entry: input.entry,
        action: "SELL",
        quantity: input.bookQty,
        role: "SL",
        reason: bar.close < stop ? "close through stop" : "close through the exit band",
      }
    }
    return {
      state: "LONG",
      stop,
      entry: input.entry,
      action: "NONE",
      quantity: 0,
      role: "SL",
      reason: "long book held",
    }
  }

  if (input.state === "LONG") {
    return { ...idle, reason: "flat book after the protective sell" }
  }

  if (input.state === "PENDING_LONG") {
    if (bar.close < exitLine || (input.stop != null && bar.close < input.stop)) {
      return { ...idle, reason: "pending entry invalidated" }
    }
    if (config.entryStyle === "BREAK_HIGH" && input.entry != null && bar.high >= input.entry) {
      return {
        state: "PENDING_LONG",
        stop: input.stop,
        entry: input.entry,
        action: config.quantity > 0 ? "BUY" : "NONE",
        quantity: config.quantity,
        role: "ENTRY",
        reason: "day high reached the pending entry",
      }
    }
    return {
      state: "PENDING_LONG",
      stop: input.stop,
      entry: input.entry,
      action: "NONE",
      quantity: 0,
      role: "ENTRY",
      reason: "waiting for the entry",
    }
  }

  if (bar.close > longLine) {
    if (config.entryStyle === "BREAK_HIGH") {
      return {
        state: "PENDING_LONG",
        stop: barStop,
        entry: bar.high,
        action: "NONE",
        quantity: 0,
        role: "ENTRY",
        reason: "close above the band; wait for a break of that high",
      }
    }
    return {
      state: "PENDING_LONG",
      stop: barStop,
      entry: bar.close,
      action: config.quantity > 0 ? "BUY" : "NONE",
      quantity: config.quantity,
      role: "ENTRY",
      reason: "close above the EMA band",
    }
  }

  return idle
}
