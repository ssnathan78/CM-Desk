import {
  CHASE_OPEN_CLASSIFY,
  defaultChaseBook,
} from "../../lib/chaseDefaults"
import {
  chaseConfigDiffFields,
  chaseConfigFieldDiffers,
  chaseConfigPrimaryBook,
  chaseOpenClassifyShortLabel,
} from "../../lib/chase/chaseBookCompare"

describe("chaseConfigPrimaryBook", () => {
  it("prefers first enabled book in index order", () => {
    const books = [
      defaultChaseBook("BANKNIFTY", true),
      defaultChaseBook("NIFTY", true),
    ]
    expect(chaseConfigPrimaryBook(books)?.instrument).toBe("NIFTY")
  })

  it("falls back to Nifty when none enabled", () => {
    const books = [defaultChaseBook("BANKNIFTY", false), defaultChaseBook("NIFTY", false)]
    expect(chaseConfigPrimaryBook(books)?.instrument).toBe("NIFTY")
  })
})

describe("chaseConfigFieldDiffers", () => {
  it("flags buffer mismatch against primary", () => {
    const primary = defaultChaseBook("NIFTY", true)
    const other = { ...defaultChaseBook("BANKNIFTY", true), bufferPercent: 0.35 }
    expect(chaseConfigFieldDiffers(other, primary, "bufferPercent")).toBe(true)
    expect(chaseConfigFieldDiffers(primary, primary, "bufferPercent")).toBe(false)
  })
})

describe("chaseConfigDiffFields", () => {
  it("collects all differing config fields", () => {
    const primary = defaultChaseBook("NIFTY", true)
    const other = {
      ...defaultChaseBook("FINNIFTY", true),
      emaPeriod: 50,
      lots: 2,
    }
    const diff = chaseConfigDiffFields(other, primary)
    expect(diff.has("emaPeriod")).toBe(true)
    expect(diff.has("lots")).toBe(true)
    expect(diff.has("bufferPercent")).toBe(false)
  })
})

describe("chaseOpenClassifyShortLabel", () => {
  it("labels PDF and legacy", () => {
    expect(chaseOpenClassifyShortLabel(CHASE_OPEN_CLASSIFY.PDF_0916)).toBe("PDF")
    expect(chaseOpenClassifyShortLabel(CHASE_OPEN_CLASSIFY.LEGACY_60M)).toBe("Legacy")
  })
})
