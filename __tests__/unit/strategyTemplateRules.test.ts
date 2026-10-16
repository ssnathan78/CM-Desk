import { EXPIRY_TYPE, expiryTypesForInstrument, INSTRUMENTS } from "../../lib/constants"
import {
  assertUniqueTemplateName,
  canDeleteTemplate,
  canUpdateJobFromTemplate,
  expiryRuleForInstrument,
  migratedTemplateName,
} from "../../lib/strategyTemplateRules"

describe("strategy template rules", () => {
  it("keeps a unique name and disambiguates collisions", () => {
    expect(
      migratedTemplateName({
        name: "Nifty",
        strategy: "ATM_STRADDLE",
        dayOfWeek: "FRIDAY",
        instrument: "NIFTY",
        nameCount: 1,
      })
    ).toBe("Nifty")
    expect(
      migratedTemplateName({
        name: "Nifty",
        strategy: "ATM_STRADDLE",
        dayOfWeek: "FRIDAY",
        instrument: "NIFTY",
        nameCount: 2,
      })
    ).toBe("Nifty ATM_STRADDLE FRIDAY NIFTY")
    expect(assertUniqueTemplateName("Nifty", ["nifty"])).toMatch(/already exists/i)
    expect(assertUniqueTemplateName("Bank", ["nifty"])).toBeNull()
  })

  it("allows two named Nifty templates on one weekday", () => {
    const names = ["Open", "Hedge"]
    expect(assertUniqueTemplateName("Open", names, "Open")).toBeNull()
    expect(assertUniqueTemplateName("Hedge", ["Open"])).toBeNull()
  })

  it("leaves a job snapshot alone when the template lots change", () => {
    const job = { lots: 1, name: "Open" }
    const template = { lots: 1, name: "Open" }
    template.lots = 4
    expect(job.lots).toBe(1)
    expect(template.lots).toBe(4)
  })

  it("refuses update-from-template after a fill", () => {
    expect(canUpdateJobFromTemplate({ status: "PENDING", filledQty: 0 }).ok).toBe(true)
    const refused = canUpdateJobFromTemplate({ status: "EXECUTING", filledQty: 1 })
    expect(refused.ok).toBe(false)
  })

  it("lists weekly expiry for Nifty and not for BankNifty", () => {
    expect(expiryTypesForInstrument(INSTRUMENTS.NIFTY)).toContain(EXPIRY_TYPE.MONTHLY)
    expect(expiryTypesForInstrument(INSTRUMENTS.BANKNIFTY)).not.toContain(EXPIRY_TYPE.MONTHLY)
    expect(expiryRuleForInstrument(INSTRUMENTS.BANKNIFTY, EXPIRY_TYPE.MONTHLY)).toMatch(/not available/i)
    expect(expiryRuleForInstrument(INSTRUMENTS.NIFTY, EXPIRY_TYPE.MONTHLY)).toBeNull()
  })

  it("refuses delete while a schedule or open job remains", () => {
    expect(canDeleteTemplate({ scheduleCount: 1, openJobCount: 0 })).toMatch(/schedule/i)
    expect(canDeleteTemplate({ scheduleCount: 0, openJobCount: 1 })).toMatch(/pending|open/i)
    expect(canDeleteTemplate({ scheduleCount: 0, openJobCount: 0 })).toBeNull()
  })
})
