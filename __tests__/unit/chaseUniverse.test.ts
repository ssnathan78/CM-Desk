import { CHASE_STATUS } from "../../lib/constants"
import {
  chaseBookMarketAccess,
  chaseRemoveBlockReason,
  chaseUnderlyingFromSymbol,
  futuresUnderlyingNames,
  normalizeChaseUnderlying,
  searchFuturesUnderlyings,
} from "../../lib/chaseUniverse"

describe("chase underlying names", () => {
  it("accepts Kite NFO names and rejects free text", () => {
    expect(normalizeChaseUnderlying(" reliance ")).toBe("RELIANCE")
    expect(normalizeChaseUnderlying("INFY")).toBe("INFY")
    expect(normalizeChaseUnderlying("NIFTY")).toBe("NIFTY")
    expect(normalizeChaseUnderlying("RELIANCE26OCTFUT")).toBeNull()
    expect(normalizeChaseUnderlying("nifty 50")).toBeNull()
    expect(normalizeChaseUnderlying("")).toBeNull()
  })

  it("reads the underlying off a futures symbol and does not guess NIFTY", () => {
    expect(chaseUnderlyingFromSymbol("RELIANCE26OCTFUT")).toBe("RELIANCE")
    expect(chaseUnderlyingFromSymbol("INFY26NOVFUT")).toBe("INFY")
    expect(chaseUnderlyingFromSymbol("NIFTY26SEPFUT")).toBe("NIFTY")
    expect(chaseUnderlyingFromSymbol("BANKNIFTY26OCTFUT")).toBe("BANKNIFTY")
    expect(chaseUnderlyingFromSymbol("MIDCPNIFTY26SEPFUT")).toBe("MIDCPNIFTY")
    expect(chaseUnderlyingFromSymbol("NIFTY26OCT17350CE")).toBeNull()
    expect(chaseUnderlyingFromSymbol("")).toBeNull()
  })
})

describe("chase market access", () => {
  it("does not touch Kite for a book that is off and flat", () => {
    expect(
      chaseBookMarketAccess({ enabled: false, status: CHASE_STATUS.AWAITING_SIGNAL })
    ).toEqual({
      hourlyCandles: false,
      signals: false,
      minuteJob: false,
    })
    expect(chaseBookMarketAccess({ enabled: false, status: null })).toMatchObject({
      hourlyCandles: false,
      signals: false,
      minuteJob: false,
    })
  })

  it("still trails an open book when Trade this book is off", () => {
    for (const status of [
      CHASE_STATUS.LONG,
      CHASE_STATUS.SHORT,
      CHASE_STATUS.AWAITING_LONG,
      CHASE_STATUS.AWAITING_SHORT,
    ]) {
      expect(chaseBookMarketAccess({ enabled: false, status })).toEqual({
        hourlyCandles: false,
        signals: false,
        minuteJob: true,
      })
    }
  })

  it("loads hourly candles only when the book is on", () => {
    expect(chaseBookMarketAccess({ enabled: true, status: CHASE_STATUS.AWAITING_SIGNAL })).toEqual({
      hourlyCandles: true,
      signals: true,
      minuteJob: true,
    })
  })
})

describe("removing a chase book", () => {
  it("refuses an open or pending book and a leftover quantity", () => {
    expect(chaseRemoveBlockReason(CHASE_STATUS.LONG, 0)).toMatch(/open or waiting/i)
    expect(chaseRemoveBlockReason(CHASE_STATUS.AWAITING_SHORT, 0)).toMatch(/open or waiting/i)
    expect(chaseRemoveBlockReason(CHASE_STATUS.AWAITING_SIGNAL, -65)).toMatch(/quantity/i)
    expect(chaseRemoveBlockReason(CHASE_STATUS.AWAITING_SIGNAL, 0)).toBeNull()
    expect(chaseRemoveBlockReason(null, 0)).toBeNull()
  })
})

describe("futures catalog", () => {
  const rows = [
    { name: "RELIANCE", instrument_type: "FUT", expiry: "2026-10-27" },
    { name: "RELIANCE", instrument_type: "CE", expiry: "2026-10-27" },
    { name: "INFY", instrument_type: "FUT", expiry: "2026-09-01" },
    { name: "TCS", instrument_type: "FUT", expiry: "2026-11-24" },
    { name: "NIFTY", instrument_type: "FUT", expiry: "2026-10-27" },
  ]

  it("keeps unexpired futures names only", () => {
    expect(futuresUnderlyingNames(rows, new Date("2026-10-12T10:00:00+05:30"))).toEqual([
      "NIFTY",
      "RELIANCE",
      "TCS",
    ])
  })

  it("searches without returning the whole dump", () => {
    const names = futuresUnderlyingNames(rows, new Date("2026-10-12T10:00:00+05:30"))
    expect(searchFuturesUnderlyings(names, "rel")).toEqual(["RELIANCE"])
    expect(searchFuturesUnderlyings(names, "")).toEqual(["NIFTY", "RELIANCE", "TCS"])
  })
})
