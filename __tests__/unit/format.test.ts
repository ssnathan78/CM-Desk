import {
  formatInr,
  formatIstDateTime,
  formatPct,
  formatPrice,
  formatPts,
  formatQty,
  pnlTone,
} from "../../lib/format"

describe("format", () => {
  it("formatInr uses en-IN and 2 decimals", () => {
    expect(formatInr(9750)).toBe("9,750.00")
    expect(formatInr(-12345)).toBe("\u221212,345.00")
    expect(formatInr(0)).toBe("0.00")
    expect(formatInr(null)).toBe("\u2014")
  })

  it("formatInr sign option", () => {
    expect(formatInr(100, { sign: true })).toBe("+100.00")
    expect(formatInr(-5, { sign: true })).toBe("\u22125.00")
  })

  it("formatPts", () => {
    expect(formatPts(-18)).toBe("\u221218.00")
  })

  it("formatQty signed", () => {
    expect(formatQty(-65, { signed: true })).toBe("\u221265")
  })

  it("formatPrice flat zero", () => {
    expect(formatPrice(0, { flat: true })).toBe("\u2014")
    expect(formatPrice(24950)).toBe("24,950.00")
  })

  it("formatPct from fraction", () => {
    expect(formatPct(0.5)).toBe("50.0%")
  })

  it("pnlTone", () => {
    expect(pnlTone(0)).toBe("zero")
    expect(pnlTone(1)).toBe("profit")
    expect(pnlTone(-1)).toBe("loss")
  })

  it("formatIstDateTime today vs other day", () => {
    const istNow = new Date()
    const formatted = formatIstDateTime(istNow)
    expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
