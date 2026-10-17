import { diffRebalancePreview } from "../../lib/momentum/rebalanceDiff"

describe("diffRebalancePreview", () => {
  it("detects added, removed, and qty changes", () => {
    const prev = [
      { symbol: "TCS", side: "BUY", quantity: 10 },
      { symbol: "INFY", side: "SELL", quantity: 5 },
    ]
    const next = [
      { symbol: "TCS", side: "BUY", quantity: 12 },
      { symbol: "RELIANCE", side: "BUY", quantity: 3 },
    ]
    const diff = diffRebalancePreview(prev, next)
    expect(diff.added).toEqual([{ symbol: "RELIANCE", side: "BUY", quantity: 3 }])
    expect(diff.removed).toEqual([{ symbol: "INFY", side: "SELL", quantity: 5 }])
    expect(diff.changed).toEqual([
      { symbol: "TCS", side: "BUY", fromQty: 10, toQty: 12 },
    ])
    expect(diff.summary).toContain("1 new")
    expect(diff.summary).toContain("1 dropped")
    expect(diff.summary).toContain("1 qty change")
  })

  it("reports unchanged when lists match", () => {
    const rows = [{ symbol: "TCS", side: "BUY", quantity: 1 }]
    const diff = diffRebalancePreview(rows, rows)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.changed).toEqual([])
    expect(diff.unchanged).toBe(1)
    expect(diff.summary).toContain("same as last preview")
  })
})
