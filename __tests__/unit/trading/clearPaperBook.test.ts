import { paperClearBlocked } from "../../../lib/trading/clearPaperBook"

describe("paperClearBlocked", () => {
  it("allows a clear when paper positions are flat and no paper order is working", () => {
    expect(paperClearBlocked({ openPaperQty: 0, workingPaperOrders: 0 })).toEqual({ ok: true })
  })

  it("refuses while a paper position is still open", () => {
    const result = paperClearBlocked({ openPaperQty: 130, workingPaperOrders: 0 })
    expect(result.ok).toBe(false)
  })

  it("refuses while a paper order is still working", () => {
    const result = paperClearBlocked({ openPaperQty: 0, workingPaperOrders: 1 })
    expect(result.ok).toBe(false)
  })
})
