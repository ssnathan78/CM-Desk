import { DEFAULT_RISK_SETTINGS } from "../../../lib/trading/riskEngine"
import {
  chaseMayTouchBrokerStop,
  planChaseRollover,
  protectiveOrderMatchesJob,
  resolveSquareOffBook,
  SQUARE_OFF_STRATEGY_REQUIRED,
} from "../../../lib/trading/exitSafety"
import { killOperatorNotice, killResponseStatus } from "../../../lib/killNotice"
import { LIVE_FLATTEN_MARKET_CLOSED } from "../../../lib/flattenNotice"

const liveSettings = {
  ...DEFAULT_RISK_SETTINGS,
  allowLiveOrders: true,
  strategies: {
    ...DEFAULT_RISK_SETTINGS.strategies,
    ATM_STRADDLE: {
      ...DEFAULT_RISK_SETTINGS.strategies.ATM_STRADDLE,
      executionMode: "LIVE" as const,
    },
    CHASE: {
      ...DEFAULT_RISK_SETTINGS.strategies.CHASE,
      executionMode: "LIVE" as const,
      enabled: true,
    },
  },
}

describe("resolveSquareOffBook", () => {
  it("refuses a live square-off that has no strategy", () => {
    expect(
      resolveSquareOffBook({ processMock: false, strategy: null, settings: liveSettings })
    ).toEqual({ action: "refuse", reason: SQUARE_OFF_STRATEGY_REQUIRED })
    expect(
      resolveSquareOffBook({ processMock: false, strategy: "  ", settings: liveSettings })
    ).toEqual({ action: "refuse", reason: SQUARE_OFF_STRATEGY_REQUIRED })
  })

  it("uses the paper book for a paper strategy and for mock mode", () => {
    expect(
      resolveSquareOffBook({
        processMock: false,
        strategy: "ATM_STRADDLE",
        settings: DEFAULT_RISK_SETTINGS,
      })
    ).toEqual({ action: "paper" })
    expect(
      resolveSquareOffBook({ processMock: true, strategy: null, settings: liveSettings })
    ).toEqual({ action: "paper" })
  })

  it("uses the live book only when the strategy is Live", () => {
    expect(
      resolveSquareOffBook({
        processMock: false,
        strategy: "ATM_STRADDLE",
        settings: liveSettings,
      })
    ).toEqual({ action: "live" })
  })
})

describe("protectiveOrderMatchesJob", () => {
  const job = {
    tag: "straddle-1",
    product: "MIS",
    exchange: "NFO",
    tradingsymbol: "NIFTY26OCT25000CE",
    quantity: 65,
  }

  it("matches only the same tag, symbol, and quantity", () => {
    expect(protectiveOrderMatchesJob(job, { ...job, quantity: -65 })).toBe(true)
  })

  it("does not cancel another strategy's stop on the same symbol", () => {
    expect(protectiveOrderMatchesJob(job, { ...job, tag: "strangle-2" })).toBe(false)
    expect(protectiveOrderMatchesJob(job, { ...job, tag: null })).toBe(false)
    expect(protectiveOrderMatchesJob({ ...job, tag: null }, job)).toBe(false)
  })
})

describe("chaseMayTouchBrokerStop", () => {
  it("allows Chase and legacy untagged stops", () => {
    expect(chaseMayTouchBrokerStop("chase")).toBe(true)
    expect(chaseMayTouchBrokerStop(" CHASE ")).toBe(true)
    expect(chaseMayTouchBrokerStop(null)).toBe(true)
  })

  it("leaves another strategy's stop alone", () => {
    expect(chaseMayTouchBrokerStop("straddle-1")).toBe(false)
  })
})

describe("planChaseRollover", () => {
  it("does not touch Kite when Chase is paper", () => {
    expect(
      planChaseRollover({ paperBook: true, marketOpen: true, strategyEnabled: true })
    ).toEqual({ flatten: "paper", touchKite: false, reason: null })
  })

  it("skips a disabled Chase book and leaves the stop", () => {
    const gate = planChaseRollover({
      paperBook: false,
      marketOpen: true,
      strategyEnabled: false,
    })
    expect(gate.flatten).toBe("skip")
    expect(gate.touchKite).toBe(false)
  })

  it("skips a live rollover while the market is closed", () => {
    const gate = planChaseRollover({
      paperBook: false,
      marketOpen: false,
      strategyEnabled: true,
    })
    expect(gate).toEqual({
      flatten: "skip",
      touchKite: false,
      reason: LIVE_FLATTEN_MARKET_CLOSED,
    })
  })

  it("flattens a live front month on Kite while the market is open", () => {
    expect(
      planChaseRollover({ paperBook: false, marketOpen: true, strategyEnabled: true })
    ).toEqual({ flatten: "live", touchKite: true, reason: null })
  })
})

describe("killOperatorNotice", () => {
  it("says the halt failed when the halt row was not saved", () => {
    const notice = killOperatorNotice({
      scope: "all",
      liveLeftOpen: false,
      chasePaused: true,
      deskHalted: false,
    })
    expect(notice?.severity).toBe("error")
    expect(notice?.text).toMatch(/halt was not saved/i)
    expect(killResponseStatus(false)).toBe(500)
  })

  it("says Chase was not paused when Kill all could not pause it", () => {
    const notice = killOperatorNotice({
      scope: "all",
      liveLeftOpen: true,
      chasePaused: false,
      deskHalted: true,
    })
    expect(notice?.text).toMatch(/Chase was not paused/i)
    expect(notice?.text).toMatch(/left open/i)
  })

  it("says Chase is paused when a closed-market Kill all left the live book open", () => {
    const notice = killOperatorNotice({
      scope: "all",
      liveLeftOpen: true,
      chasePaused: true,
      deskHalted: true,
    })
    expect(notice?.text).toMatch(/Chase is paused/)
    expect(killResponseStatus(true)).toBe(200)
  })

  it("says flatten did not run when the flatten call threw", () => {
    const notice = killOperatorNotice({
      scope: "all",
      liveLeftOpen: false,
      chasePaused: true,
      deskHalted: true,
      flattenFailed: true,
    })
    expect(notice?.severity).toBe("error")
    expect(notice?.text).toMatch(/Flatten did not run/i)
    expect(notice?.text).toMatch(/Chase is paused/)
    expect(notice?.text).toMatch(/desk is halted/i)
  })

  it("stays quiet when an open-market kill halted and paused", () => {
    expect(
      killOperatorNotice({
        scope: "all",
        liveLeftOpen: false,
        chasePaused: true,
        deskHalted: true,
      })
    ).toBeNull()
  })
})
