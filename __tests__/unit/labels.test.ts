import { isKnownCode, labelFor } from "../../lib/ui/labels"

describe("labelFor", () => {
  it("maps strategy and book codes", () => {
    expect(labelFor("ATM_STRADDLE")).toBe("ATM straddle")
    expect(labelFor("MIDCPNIFTY")).toBe("Midcap Nifty")
    expect(labelFor("EXIT")).toBe("Exit")
    expect(labelFor("HEDGE")).toBe("Hedge")
    expect(labelFor("MAX_NOTIONAL")).toBe("Max notional")
    expect(labelFor("ORDER_REJECTED")).toBe("Order rejected")
    expect(labelFor("MISSING_ORDER")).toBe("Missing order")
  })

  it("humanizes unknown codes", () => {
    expect(labelFor("UNKNOWN_X")).toBe("Unknown X")
    expect(labelFor("CHASE_AWAITING_SIGNAL")).toBe("Chase Awaiting Signal")
    expect(isKnownCode("CHASE")).toBe(true)
    expect(isKnownCode("UNKNOWN_X")).toBe(false)
  })
})
