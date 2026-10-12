import { historyRange } from "../../../lib/trading/historyRange"

describe("historyRange", () => {
  const oct = new Date("2026-10-12T20:00:00+05:30")

  it("defaults the named presets to inclusive IST bounds", () => {
    expect(historyRange("today", {}, oct)).toEqual({
      from: "2026-10-12T00:00:00+05:30",
      to: "2026-10-12T23:59:59+05:30",
    })
    expect(historyRange("month", {}, oct).from).toBe("2026-10-01T00:00:00+05:30")
    expect(historyRange("quarter", {}, oct).from).toBe("2026-10-01T00:00:00+05:30")
    expect(historyRange("year", {}, oct).from).toBe("2026-01-01T00:00:00+05:30")
    expect(historyRange("all", {}, oct)).toEqual({})
  })

  it("starts the quarter on the first day of that IST quarter", () => {
    expect(historyRange("quarter", {}, new Date("2026-02-01T10:00:00+05:30")).from).toBe(
      "2026-01-01T00:00:00+05:30"
    )
    expect(historyRange("quarter", {}, new Date("2026-05-15T10:00:00+05:30")).from).toBe(
      "2026-04-01T00:00:00+05:30"
    )
  })

  it("uses the custom dates as IST midnights", () => {
    expect(historyRange("custom", { from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-09-01T00:00:00+05:30",
      to: "2026-09-30T23:59:59+05:30",
    })
  })
})
