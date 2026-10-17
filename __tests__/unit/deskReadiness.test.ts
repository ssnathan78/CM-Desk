import { evaluateDeskReadiness, type DeskReadinessInput } from "../../lib/trading/deskReadiness"
import { DEFAULT_RISK_SETTINGS, RISK_STRATEGY_KEYS } from "../../lib/trading/riskEngine"

function baseInput(overrides: Partial<DeskReadinessInput> = {}): DeskReadinessInput {
  const strategies = {} as DeskReadinessInput["strategies"]
  for (const key of RISK_STRATEGY_KEYS) {
    const row = DEFAULT_RISK_SETTINGS.strategies[key]
    strategies[key] = {
      enabled: row.enabled,
      halted: row.halted,
      executionMode: row.executionMode,
      openPositions: 0,
    }
  }
  return {
    mockOrders: false,
    allowLiveOrders: true,
    tradingEnabled: true,
    deskHalted: false,
    haltReason: null,
    kiteSessionOk: true,
    strategies,
    paperOpenPositions: 0,
    liveOpenPositions: 0,
    marketSession: "OPEN",
    requireMarketHours: true,
    ...overrides,
  }
}

describe("evaluateDeskReadiness", () => {
  it("ready when all gates pass and a strategy is live", () => {
    const input = baseInput({
      strategies: {
        ...baseInput().strategies,
        CHASE: { ...baseInput().strategies.CHASE, executionMode: "LIVE" },
      },
    })
    const { ready, blockers } = evaluateDeskReadiness(input)
    expect(ready).toBe(true)
    expect(blockers.some(b => b.severity === "error")).toBe(false)
  })

  it("not ready when mock orders on", () => {
    const { ready, blockers } = evaluateDeskReadiness(baseInput({ mockOrders: true }))
    expect(ready).toBe(false)
    expect(blockers.some(b => b.id === "mock_orders")).toBe(true)
  })

  it("not ready when allow live off", () => {
    const { ready } = evaluateDeskReadiness(baseInput({ allowLiveOrders: false }))
    expect(ready).toBe(false)
  })

  it("not ready when kite session missing", () => {
    const { ready } = evaluateDeskReadiness(baseInput({ kiteSessionOk: false }))
    expect(ready).toBe(false)
  })

  it("not ready when desk halted", () => {
    const { ready } = evaluateDeskReadiness(
      baseInput({ deskHalted: true, haltReason: "operator test" })
    )
    expect(ready).toBe(false)
  })

  it("warns on paper leftover with live strategy", () => {
    const strategies = baseInput().strategies
    strategies.CHASE = { ...strategies.CHASE, executionMode: "LIVE" }
    const { ready, blockers } = evaluateDeskReadiness(
      baseInput({ strategies, paperOpenPositions: 2 })
    )
    expect(ready).toBe(true)
    expect(blockers.some(b => b.id === "paper_leftover")).toBe(true)
  })

  it("info when no strategy set to live", () => {
    const { blockers } = evaluateDeskReadiness(baseInput())
    expect(blockers.some(b => b.id === "no_live_strategy")).toBe(true)
  })
})
