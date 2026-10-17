export type HourlyBar = { close: number; high: number; low: number }

export function typicalPrices(bars: HourlyBar[]): number[] {
  return bars.map(bar => (bar.high + bar.low + bar.close) / 3)
}

/** EMA of typical price for each bar index (needs `period` bars before first value). */
export function emaSeriesFromTypical(typical: number[], period: number): (number | null)[] {
  if (period < 1 || typical.length === 0) return typical.map(() => null)
  const multiplier = 2 / (period + 1)
  const out: (number | null)[] = typical.map(() => null)
  if (typical.length < period) return out

  let ema = typical.slice(0, period).reduce((sum, v) => sum + v, 0) / period
  out[period - 1] = ema
  for (let i = period; i < typical.length; i++) {
    ema = typical[i] * multiplier + ema * (1 - multiplier)
    out[i] = ema
  }
  return out
}

export function bufferBands(
  emaValues: (number | null)[],
  bufferPercent: number
): { upper: (number | null)[]; lower: (number | null)[] } {
  const factor = bufferPercent / 100
  const upper = emaValues.map(v => (v == null ? null : v * (1 + factor)))
  const lower = emaValues.map(v => (v == null ? null : v * (1 - factor)))
  return { upper, lower }
}

/** Pad min/max so flat lines still render with height. */
export function sparkChartScale(
  values: number[],
  paddingRatio = 0.08
): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 1 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * paddingRatio || 1)
    return { min: min - pad, max: max + pad }
  }
  const span = max - min
  const pad = span * paddingRatio
  return { min: min - pad, max: max + pad }
}

export function buildChaseSparkSeries(bars: HourlyBar[], emaPeriod: number, bufferPercent: number) {
  const closes = bars.map(b => b.close)
  const typical = typicalPrices(bars)
  const ema = emaSeriesFromTypical(typical, emaPeriod)
  const bands = bufferBands(ema, bufferPercent)
  const scaleValues = [
    ...closes,
    ...ema.filter((v): v is number => v != null),
    ...bands.upper.filter((v): v is number => v != null),
    ...bands.lower.filter((v): v is number => v != null),
  ]
  const scale = sparkChartScale(scaleValues)
  return { closes, ema, upper: bands.upper, lower: bands.lower, scale }
}
