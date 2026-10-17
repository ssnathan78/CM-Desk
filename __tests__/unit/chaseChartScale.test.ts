import {
  buildChaseSparkSeries,
  emaSeriesFromTypical,
  sparkChartScale,
} from "../../lib/chase/chartSeries"

describe("sparkChartScale", () => {
  it("pads flat series", () => {
    const scale = sparkChartScale([100, 100, 100])
    expect(scale.min).toBeLessThan(100)
    expect(scale.max).toBeGreaterThan(100)
  })

  it("adds padding on a range", () => {
    const scale = sparkChartScale([90, 110])
    expect(scale.min).toBeLessThan(90)
    expect(scale.max).toBeGreaterThan(110)
  })
})

describe("buildChaseSparkSeries", () => {
  it("aligns closes and ema length", () => {
    const bars = Array.from({ length: 45 }, (_, i) => ({
      close: 100 + i,
      high: 101 + i,
      low: 99 + i,
    }))
    const series = buildChaseSparkSeries(bars, 40, 0.2)
    expect(series.closes).toHaveLength(45)
    expect(series.ema).toHaveLength(45)
    expect(series.ema[44]).not.toBeNull()
    expect(series.upper[44]).toBeGreaterThan(series.ema[44]!)
  })
})

describe("emaSeriesFromTypical", () => {
  it("returns null until period is satisfied", () => {
    const ema = emaSeriesFromTypical([1, 2, 3], 5)
    expect(ema.every(v => v === null)).toBe(true)
  })
})
