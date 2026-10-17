import { isKnownCode, labelFor } from "../../lib/ui/labels"

describe("labelFor", () => {
  it("maps strategy and book codes", () => {
    expect(labelFor("ATM_STRADDLE")).toBe("ATM straddle")
    expect(labelFor("MIDCPNIFTY")).toBe("Midcap Nifty")
    expect(labelFor("EXIT")).toBe("Exit")
    expect(labelFor("HEDGE")).toBe("Hedge")
  })

  it("falls back to raw code", () => {
    expect(labelFor("UNKNOWN_X")).toBe("UNKNOWN_X")
    expect(isKnownCode("CHASE")).toBe(true)
    expect(isKnownCode("UNKNOWN_X")).toBe(false)
  })
})
