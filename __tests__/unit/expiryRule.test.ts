import { EXPIRY_TYPE, INSTRUMENTS } from "../../lib/constants"
import { daysUntilExpiry, expiryRuleLabel, formatExpiryPreview, pickExpiryDate } from "../../lib/expiryRule"

describe("expiry rules", () => {
  const weekly = ["2026-10-20", "2026-10-27", "2026-10-27", "2026-11-03"]
  const monthly = ["2026-10-27", "2026-11-24"]

  it("names Nifty weeklies and BankNifty months", () => {
    expect(expiryRuleLabel(INSTRUMENTS.NIFTY, EXPIRY_TYPE.CURRENT)).toBe("Current week expiry")
    expect(expiryRuleLabel(INSTRUMENTS.NIFTY, EXPIRY_TYPE.NEXT)).toBe("Next week expiry")
    expect(expiryRuleLabel(INSTRUMENTS.NIFTY, EXPIRY_TYPE.MONTHLY)).toBe("Monthly expiry")
    expect(expiryRuleLabel(INSTRUMENTS.BANKNIFTY, EXPIRY_TYPE.CURRENT)).toBe("Current month expiry")
    expect(expiryRuleLabel(INSTRUMENTS.BANKNIFTY, EXPIRY_TYPE.NEXT)).toBe("Next month expiry")
  })

  it("picks the contract date for the rule and counts days", () => {
    expect(pickExpiryDate(weekly, true, EXPIRY_TYPE.CURRENT)).toBe("2026-10-20")
    expect(pickExpiryDate(weekly, true, EXPIRY_TYPE.NEXT)).toBe("2026-10-27")
    expect(pickExpiryDate(weekly, true, EXPIRY_TYPE.MONTHLY)).toBe("2026-10-27")
    expect(pickExpiryDate(monthly, false, EXPIRY_TYPE.CURRENT)).toBe("2026-10-27")
    expect(pickExpiryDate(monthly, false, EXPIRY_TYPE.NEXT)).toBe("2026-11-24")
    expect(daysUntilExpiry("2026-10-22", "2026-10-16")).toBe(6)
    expect(formatExpiryPreview("2026-10-22", "2026-10-16")).toBe("22 Oct · 6 days")
  })

  it("ignores repeated strikes of the near expiry", () => {
    const chain = [
      ...Array.from({ length: 40 }, () => "2026-10-20"),
      "2026-10-27",
      "2026-11-24",
    ]
    expect(pickExpiryDate(chain, true, EXPIRY_TYPE.CURRENT)).toBe("2026-10-20")
    expect(pickExpiryDate(chain, true, EXPIRY_TYPE.NEXT)).toBe("2026-10-27")
    expect(pickExpiryDate(chain, true, EXPIRY_TYPE.MONTHLY)).toBe("2026-10-27")
  })
})
