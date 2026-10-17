import { previewSetupNotional } from "../../lib/forms/riskWhatIf"
import type { DeskSetupNotional } from "../../lib/trading/setupNotional"

describe("previewSetupNotional", () => {
  const setups: DeskSetupNotional = {
    maxNotionalInr: 1_000_000,
    rows: [
      {
        source: "CHASE",
        label: "Nifty Chase",
        strategy: "CHASE",
        instrument: "NIFTY",
        lots: 1,
        lotSize: 65,
        qty: 65,
        legs: 1,
        price: 25000,
        priceNote: "",
        notional: 1_625_000,
        maxNotionalInr: 1_000_000,
        overCap: true,
        detail: "test",
      },
    ],
  }

  it("recalculates over cap when draft cap rises", () => {
    const rows = previewSetupNotional(setups, 2_000_000)
    expect(rows[0].overCap).toBe(false)
  })
})
