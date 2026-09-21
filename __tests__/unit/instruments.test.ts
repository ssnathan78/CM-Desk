import { chaseIndexFromSymbol } from "../../lib/chaseValidation"
import {
  EXPIRY_TYPE,
  expiryTypesForInstrument,
  INSTRUMENT_DETAILS,
  INSTRUMENTS,
} from "../../lib/constants"

describe("index contract specs (2026 NSE)", () => {
  it("uses current lot sizes", () => {
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.NIFTY].lotSize).toBe(65)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.BANKNIFTY].lotSize).toBe(30)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.FINNIFTY].lotSize).toBe(60)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.MIDCPNIFTY].lotSize).toBe(120)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.MIDCPNIFTY].nfoSymbol).toBe("MIDCPNIFTY")
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.MIDCPNIFTY].underlyingSymbol).toBe("NIFTY MID SELECT")
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.MIDCPNIFTY].strikeStepSize).toBe(25)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.MIDCPNIFTY].freezeQty).toBe(2800)
  })

  it("maps MIDCPNIFTY futures symbols without collapsing to NIFTY", () => {
    expect(chaseIndexFromSymbol("MIDCPNIFTY26SEPFUT")).toBe("MIDCPNIFTY")
    expect(chaseIndexFromSymbol("NIFTY26SEPFUT")).toBe("NIFTY")
  })

  it("only Nifty has weekly expiry options in the UI", () => {
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.NIFTY].hasWeeklyExpiry).toBe(true)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.BANKNIFTY].hasWeeklyExpiry).toBe(false)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.FINNIFTY].hasWeeklyExpiry).toBe(false)
    expect(INSTRUMENT_DETAILS[INSTRUMENTS.MIDCPNIFTY].hasWeeklyExpiry).toBe(false)
    expect(expiryTypesForInstrument(INSTRUMENTS.NIFTY)).toContain(EXPIRY_TYPE.MONTHLY)
    expect(expiryTypesForInstrument(INSTRUMENTS.BANKNIFTY)).not.toContain(EXPIRY_TYPE.MONTHLY)
  })
})
