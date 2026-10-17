import { groupStrategyRealized, groupTodayBooks } from "../../lib/trading/todayGroups"

describe("today strategy groups", () => {
  it("keeps closed today separate from the open mark", () => {
    const rows = groupTodayBooks({
      closed: [
        { strategy: "ATM_STRADDLE", netPnl: "100" },
        { strategy: "CHASE", netPnl: "-40" },
      ],
      open: [
        { strategy: "CHASE", unrealized: "250" },
        { strategy: "ATM_STRANGLE", unrealized: "-10" },
      ],
    })
    const intraday = rows.find(row => row.id === "intraday")
    const chase = rows.find(row => row.id === "chase")
    expect(intraday).toMatchObject({ open: 1, closedToday: "100.0000", openMark: "-10.0000" })
    expect(chase).toMatchObject({ open: 1, closedToday: "-40.0000", openMark: "250.0000" })
    expect(rows.find(row => row.id === "daily")?.open).toBe(0)
    expect(rows.find(row => row.id === "momentum")?.open).toBe(0)
  })
})

describe("strategy realized groups", () => {
  it("sums lifetime realized on the books into the same groups", () => {
    const rows = groupStrategyRealized([
      { strategy: "ATM_STRADDLE", realized: "100" },
      { strategy: "ATM_STRANGLE", realized: "25" },
      { strategy: "CHASE", realized: "-40" },
      { strategy: "UNATTRIBUTED", realized: "7" },
    ])
    expect(rows.find(row => row.id === "intraday")?.realized).toBe("125.0000")
    expect(rows.find(row => row.id === "chase")?.realized).toBe("-40.0000")
    expect(rows.find(row => row.id === "daily")?.realized).toBe("0.0000")
    expect(rows.find(row => row.id === "momentum")?.realized).toBe("0.0000")
    expect(rows.find(row => row.id === "other")?.realized).toBe("7.0000")
  })
})
