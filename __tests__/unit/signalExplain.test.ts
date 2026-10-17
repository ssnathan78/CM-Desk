import { signalExplain } from "../../lib/ui/signalExplain"

describe("signalExplain", () => {
  it("explains EMA compare features", () => {
    const line = signalExplain({
      kind: "EMA_COMPARE",
      outcome: "WAIT",
      summary: "Waiting for signal",
      features: { close: 24500, ema: 24480, bufferPts: 12 },
    })
    expect(line).toContain("24500")
    expect(line).toContain("24480")
  })
})
