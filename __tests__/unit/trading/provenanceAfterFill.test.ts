import { provenanceAfterFill } from "../../../lib/trading/types"

describe("provenanceAfterFill", () => {
  it("promotes a cleared paper row when the fill is live", () => {
    expect(
      provenanceAfterFill({
        positionProvenance: "PAPER",
        positionQty: 0,
        fillProvenance: "RECONCILED",
      })
    ).toBe("RECONCILED")
  })

  it("does not retag an open paper position", () => {
    expect(
      provenanceAfterFill({
        positionProvenance: "PAPER",
        positionQty: 65,
        fillProvenance: "LIVE",
      })
    ).toBe("PAPER")
  })

  it("keeps an existing live book", () => {
    expect(
      provenanceAfterFill({
        positionProvenance: "LIVE",
        positionQty: 130,
        fillProvenance: "RECONCILED",
      })
    ).toBe("LIVE")
  })
})
