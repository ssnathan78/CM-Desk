import { buildConstituentImpactPreview } from "../../lib/momentum/constituentPreview"

describe("buildConstituentImpactPreview", () => {
  it("lists trend books affected by removes", () => {
    const preview = buildConstituentImpactPreview(
      [{ action: "REMOVE", symbol: "RELIANCE" }],
      ["RELIANCE", "TCS"]
    )
    expect(preview.trend.openBooksAffected).toEqual(["RELIANCE"])
    expect(preview.trend.wouldAdd).toEqual([])
  })
})
