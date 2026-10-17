import { buildReconSummary } from "../../lib/trading/reconSummary"

describe("buildReconSummary", () => {
  it("ok when no unresolved", () => {
    const s = buildReconSummary({
      unresolved: [],
      lastCompletedAt: new Date("2026-01-02T10:00:00Z"),
      openLedgerPositions: 2,
      reconAlertCount: 0,
    })
    expect(s.status).toBe("ok")
    expect(s.unresolvedCount).toBe(0)
  })

  it("attention when unresolved rows exist", () => {
    const s = buildReconSummary({
      unresolved: [
        {
          id: 1,
          kind: "POSITION_MISMATCH",
          severity: "WARN",
          tradingsymbol: "NIFTY26JANFUT",
          detail: "qty gap",
          occurredAt: new Date(),
          resolved: false,
        },
      ],
      lastCompletedAt: null,
      openLedgerPositions: 1,
      reconAlertCount: 1,
    })
    expect(s.status).toBe("attention")
    expect(s.unresolvedCount).toBe(1)
  })
})
