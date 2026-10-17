import { deriveEntriesChip, deriveModeChip } from "../../lib/ui/deskStatus"
import type { DeskStatusPayload } from "../../lib/ui/deskStatus"

function base(over: Partial<DeskStatusPayload> = {}): DeskStatusPayload {
  return {
    mockOrders: false,
    allowLiveOrders: true,
    tradingEnabled: true,
    deskHalted: false,
    haltReason: null,
    market: { session: "OPEN", isTradingDay: true },
    strategies: {
      ATM_STRADDLE: {
        enabled: true,
        halted: false,
        haltReason: null,
        executionMode: "PAPER",
        openPositions: 0,
      },
      ATM_STRANGLE: {
        enabled: true,
        halted: false,
        haltReason: null,
        executionMode: "PAPER",
        openPositions: 0,
      },
      CHASE: {
        enabled: true,
        halted: false,
        haltReason: null,
        executionMode: "LIVE",
        openPositions: 1,
      },
      MOMENTUM: {
        enabled: false,
        halted: false,
        haltReason: null,
        executionMode: "PAPER",
        openPositions: 0,
      },
      DAILY_TREND: {
        enabled: false,
        halted: false,
        haltReason: null,
        executionMode: "PAPER",
        openPositions: 0,
      },
    },
    ...over,
  }
}

describe("deskStatus chips", () => {
  it("entries: trading off when tradingEnabled false", () => {
    const chip = deriveEntriesChip(base({ tradingEnabled: false }))
    expect(chip.label).toBe("Trading off")
    expect(chip.tone).toBe("attention")
  })

  it("entries: halt wins over trading off", () => {
    const chip = deriveEntriesChip(
      base({ deskHalted: true, haltReason: "test", tradingEnabled: false })
    )
    expect(chip.label).toBe("Halted: test")
    expect(chip.tone).toBe("danger")
  })

  it("mode: mock overrides live", () => {
    const chip = deriveModeChip(base({ mockOrders: true }))
    expect(chip.label).toBe("MOCK")
    expect(chip.tone).toBe("mock")
  })

  it("mode: live strategies listed", () => {
    const chip = deriveModeChip(base())
    expect(chip.label).toContain("LIVE")
    expect(chip.label).toContain("Chase")
  })
})
