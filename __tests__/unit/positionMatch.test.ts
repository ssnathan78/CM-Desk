import { matchPositionForFill, strategyForOrder } from "../../lib/trading/positionMatch"

describe("matchPositionForFill", () => {
  it("updates the Chase row when the fill has no strategy", () => {
    const chase = { id: "chase", strategy: "CHASE" }
    expect(matchPositionForFill([chase], null)).toEqual({ action: "use", row: chase })
  })

  it("claims a single untagged row for a Chase fill", () => {
    const blank = { id: "blank", strategy: null }
    expect(matchPositionForFill([blank], "CHASE")).toEqual({ action: "use", row: blank })
  })

  it("does not let momentum update a daily-trend row", () => {
    const trend = { id: "trend", strategy: "DAILY_TREND" }
    expect(matchPositionForFill([trend], "MOMENTUM")).toEqual({ action: "insert" })
  })

  it("refuses an untagged fill when two strategies already hold the contract", () => {
    const match = matchPositionForFill(
      [
        { id: "chase", strategy: "CHASE" },
        { id: "momentum", strategy: "MOMENTUM" },
      ],
      null
    )
    expect(match.action).toBe("refuse")
  })

  it("prefers the exact strategy when an untagged row is also present", () => {
    const chase = { id: "chase", strategy: "CHASE" }
    const blank = { id: "blank", strategy: "" }
    expect(matchPositionForFill([blank, chase], "CHASE")).toEqual({ action: "use", row: chase })
  })
})

describe("strategyForOrder", () => {
  it("keeps an explicit strategy", () => {
    expect(strategyForOrder({ strategy: "ATM_STRADDLE", orderTag: "chase" })).toBe("ATM_STRADDLE")
  })

  it("tags a chase broker snapshot that arrived without a strategy", () => {
    expect(strategyForOrder({ strategy: null, orderTag: "chase" })).toBe("CHASE")
  })

  it("does not invent a strategy for any other tag", () => {
    expect(strategyForOrder({ orderTag: "x5HWFm4U" })).toBeNull()
  })
})
