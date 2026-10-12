import {
  ledgerProvenance,
  parsePositionView,
  parseTradeBook,
  positionMatchesView,
  provenanceInBook,
} from "../../../lib/trading/types"

describe("parseTradeBook", () => {
  it("accepts PAPER and LIVE and defaults the rest to ALL", () => {
    expect(parseTradeBook("PAPER")).toBe("PAPER")
    expect(parseTradeBook("LIVE")).toBe("LIVE")
    expect(parseTradeBook("ALL")).toBe("ALL")
    expect(parseTradeBook("nope")).toBe("ALL")
    expect(parseTradeBook(undefined)).toBe("ALL")
  })
})

describe("provenanceInBook", () => {
  it("puts PAPER and MOCK in the paper book", () => {
    expect(provenanceInBook("PAPER", "PAPER")).toBe(true)
    expect(provenanceInBook("MOCK", "PAPER")).toBe(true)
    expect(provenanceInBook("LIVE", "PAPER")).toBe(false)
  })

  it("puts LIVE, RECONCILED, and MIGRATED in the live book", () => {
    expect(provenanceInBook("LIVE", "LIVE")).toBe(true)
    expect(provenanceInBook("RECONCILED", "LIVE")).toBe(true)
    expect(provenanceInBook("MIGRATED", "LIVE")).toBe(true)
    expect(provenanceInBook("PAPER", "LIVE")).toBe(false)
    expect(provenanceInBook("MOCK", "LIVE")).toBe(false)
  })
})

describe("positionMatchesView", () => {
  it("defaults the positions list to the live book", () => {
    expect(parsePositionView("LIVE")).toBe("LIVE")
    expect(parsePositionView("nope")).toBeNull()
    expect(positionMatchesView("LIVE", "LIVE")).toBe(true)
    expect(positionMatchesView("RECONCILED", "LIVE")).toBe(false)
    expect(positionMatchesView("MIGRATED", "LIVE")).toBe(false)
    expect(positionMatchesView("PAPER", "LIVE")).toBe(false)
  })

  it("adds reconciled and migrated rows without paper", () => {
    expect(positionMatchesView("LIVE", "WITH_RECON")).toBe(true)
    expect(positionMatchesView("RECONCILED", "WITH_RECON")).toBe(true)
    expect(positionMatchesView("MIGRATED", "WITH_RECON")).toBe(true)
    expect(positionMatchesView("PAPER", "WITH_RECON")).toBe(false)
    expect(positionMatchesView("MOCK", "PAPER")).toBe(true)
  })
})

describe("ledgerProvenance", () => {
  it("defaults missing provenance to PAPER, never LIVE", () => {
    expect(ledgerProvenance(undefined)).toBe("PAPER")
    expect(ledgerProvenance(null)).toBe("PAPER")
    expect(ledgerProvenance("LIVE")).toBe("LIVE")
    expect(ledgerProvenance("MOCK")).toBe("MOCK")
  })
})
