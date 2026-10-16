import { groupTodayBooks } from "../../lib/trading/todayGroups"

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
