import {
  aggregateChaseConfig,
  CHASE_MASTER_DEFAULTS,
  chaseAllowsNewEntry,
  chaseManagesOpenPosition,
  chaseMarketProtectionPrice,
  chaseTolerances,
  defaultChaseBook,
  normalizeChaseMarketProtection,
} from "../../lib/chaseDefaults"

describe("chaseTolerances", () => {
  it("uses 0.2% around EMA as the shipped long/short band", () => {
    const { longTolerance, shortTolerance } = chaseTolerances(10000, 0.2)
    expect(longTolerance).toBeCloseTo(10020, 6)
    expect(shortTolerance).toBeCloseTo(9980, 6)
  })

  it("widens both sides when the buffer increases", () => {
    const tight = chaseTolerances(10000, 0.2)
    const wide = chaseTolerances(10000, 1)
    expect(wide.longTolerance).toBeGreaterThan(tight.longTolerance)
    expect(wide.shortTolerance).toBeLessThan(tight.shortTolerance)
  })
})

describe("aggregateChaseConfig", () => {
  it("keeps lots independent per enabled book", () => {
    const nifty = { ...defaultChaseBook("NIFTY", true), lots: 1 }
    const bank = { ...defaultChaseBook("BANKNIFTY", true), lots: 3, paused: false }
    const fin = defaultChaseBook("FINNIFTY", false)
    const aggregated = aggregateChaseConfig([nifty, bank, fin])
    expect(aggregated.instruments).toEqual(["NIFTY", "BANKNIFTY"])
    expect(aggregated.lots).toBe(1)
    expect(aggregated.paused).toBe(false)
  })
})

describe("CHASE_MASTER_DEFAULTS", () => {
  it("ships the historical Chase engine numbers", () => {
    expect(CHASE_MASTER_DEFAULTS).toEqual({
      lots: 1,
      emaPeriod: 40,
      bufferPercent: 0.2,
      entryLimitOffset: 5,
      marketProtectionPercent: 1.5,
      paused: false,
      instruments: ["NIFTY"],
      openClassify: "pdf_0916",
    })
  })
})

describe("chaseMarketProtectionPrice", () => {
  it("defaults a missing percent to 1.5", () => {
    expect(normalizeChaseMarketProtection(undefined)).toBe(1.5)
    expect(normalizeChaseMarketProtection(9)).toBe(5)
    expect(normalizeChaseMarketProtection(0)).toBe(0.25)
  })

  it("keeps a 1.5% Nifty sell inside the 10:22 exchange band and a 2% sell outside it", () => {
    const ltp = 23223
    const exchangeFloor = 22759.3
    expect(chaseMarketProtectionPrice(ltp, "SELL", 2)).toBeLessThan(exchangeFloor)
    expect(chaseMarketProtectionPrice(ltp, "SELL", 1.5)).toBeGreaterThan(exchangeFloor)
    expect(chaseMarketProtectionPrice(ltp, "SELL", 1.75)).toBeGreaterThan(exchangeFloor)
  })
})

describe("Chase pause / resume", () => {
  it("blocks new entries while paused", () => {
    expect(chaseAllowsNewEntry(true)).toBe(false)
    expect(chaseAllowsNewEntry(false)).toBe(true)
  })

  it("still manages an open LONG or SHORT while paused", () => {
    expect(chaseManagesOpenPosition(true, "LONG")).toBe(true)
    expect(chaseManagesOpenPosition(true, "SHORT")).toBe(true)
    expect(chaseManagesOpenPosition(true, "AWAITING_SIGNAL")).toBe(false)
    expect(chaseManagesOpenPosition(true, "AWAITING_LONG")).toBe(false)
  })
})
