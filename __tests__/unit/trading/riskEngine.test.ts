import {
  DEFAULT_RISK_SETTINGS,
  evaluateOrder,
  executionProvenance,
  inferOrderRole,
  isPaperStrategy,
  lotsForRiskCheck,
  type RiskContext,
  type RiskIntent,
} from "../../../lib/trading/riskEngine"

function intent(overrides: Partial<RiskIntent> = {}): RiskIntent {
  return {
    role: "ENTRY",
    tradingsymbol: "NIFTY25SEP25000CE",
    quantity: 65,
    side: "SELL",
    product: "MIS",
    orderType: "MARKET",
    tag: "job-1",
    lots: 1,
    ltp: 120,
    ltpAt: new Date("2026-09-05T10:00:00+05:30"),
    ...overrides,
  }
}

function ctx(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    settings: { ...DEFAULT_RISK_SETTINGS },
    now: new Date("2026-09-05T10:00:01+05:30"),
    isMock: true,
    isPaper: false,
    marketOpen: true,
    jobAborted: false,
    openPositionCount: 0,
    openOrderCount: 0,
    recentOrderCount: 0,
    pendingDuplicate: false,
    ...overrides,
  }
}

describe("inferOrderRole", () => {
  it("treats flatten and square-off as flatten", () => {
    expect(inferOrderRole({ purpose: "FLATTEN" })).toBe("FLATTEN")
    expect(inferOrderRole({ purpose: "SQUARE_OFF" })).toBe("FLATTEN")
  })

  it("treats SL order types as SL even without purpose", () => {
    expect(inferOrderRole({ orderType: "SL-M" })).toBe("SL")
    expect(inferOrderRole({ purpose: "EXIT" })).toBe("EXIT")
  })

  it("defaults market entries to ENTRY", () => {
    expect(inferOrderRole({ orderType: "MARKET" })).toBe("ENTRY")
  })

  it("keeps an entry stop as ENTRY and a protective stop as SL", () => {
    expect(inferOrderRole({ purpose: "ENTRY", orderType: "SL" })).toBe("ENTRY")
    expect(inferOrderRole({ purpose: "entry", orderType: "SL-M" })).toBe("ENTRY")
    expect(inferOrderRole({ purpose: "ENTRY", orderType: "SL-L" })).toBe("ENTRY")
    expect(inferOrderRole({ purpose: "SL", orderType: "SL" })).toBe("SL")
    expect(inferOrderRole({ purpose: "SL", orderType: "MARKET" })).toBe("SL")
    expect(inferOrderRole({ orderType: "SL" })).toBe("SL")
    expect(inferOrderRole({ orderType: "SL-M" })).toBe("SL")
    expect(inferOrderRole({ purpose: "FLATTEN", orderType: "MARKET" })).toBe("FLATTEN")
  })
})

/** Same classification placeOrder uses: purpose and order type, then evaluateOrder. */
function chaseEntryStop(): RiskIntent {
  return intent({
    role: inferOrderRole({ purpose: "ENTRY", orderType: "SL" }),
    orderType: "SL",
    strategy: "CHASE",
    tradingsymbol: "NIFTY26OCTFUT",
    side: "BUY",
    product: "NRML",
    tag: "chase",
    quantity: 65,
    lots: 1,
    ltp: 25000,
    triggerPrice: 25100,
  })
}

describe("Chase entry stop is an entry", () => {
  it("desk halt, trading disabled, strategy halt, and live-blocked reject it", () => {
    const halted = evaluateOrder(
      chaseEntryStop(),
      ctx({ settings: { ...DEFAULT_RISK_SETTINGS, deskHalted: true, haltReason: "kill" } })
    )
    expect(halted.ok).toBe(false)
    if (!halted.ok) expect(halted.code).toBe("DESK_HALTED")

    const tradingOff = evaluateOrder(
      chaseEntryStop(),
      ctx({ settings: { ...DEFAULT_RISK_SETTINGS, tradingEnabled: false } })
    )
    expect(tradingOff.ok).toBe(false)
    if (!tradingOff.ok) expect(tradingOff.code).toBe("TRADING_DISABLED")

    const stratHalted = {
      ...DEFAULT_RISK_SETTINGS,
      strategies: {
        ...DEFAULT_RISK_SETTINGS.strategies,
        CHASE: {
          ...DEFAULT_RISK_SETTINGS.strategies.CHASE,
          halted: true,
          haltReason: "pause",
        },
      },
    }
    const paused = evaluateOrder(chaseEntryStop(), ctx({ settings: stratHalted }))
    expect(paused.ok).toBe(false)
    if (!paused.ok) expect(paused.code).toBe("STRATEGY_HALTED")

    const live = evaluateOrder(chaseEntryStop(), ctx({ isMock: false, isPaper: false }))
    expect(live.ok).toBe(false)
    if (!live.ok) expect(live.code).toBe("LIVE_BLOCKED")
  })

  it("applies max notional, max lots, and max positions to the entry stop", () => {
    const notional = evaluateOrder(
      chaseEntryStop(),
      ctx({ settings: { ...DEFAULT_RISK_SETTINGS, maxNotionalInr: 100_000 } })
    )
    expect(notional.ok).toBe(false)
    if (!notional.ok) expect(notional.code).toBe("MAX_NOTIONAL")

    const lots = evaluateOrder(
      intent({
        ...chaseEntryStop(),
        lots: 21,
      }),
      ctx()
    )
    expect(lots.ok).toBe(false)
    if (!lots.ok) expect(lots.code).toBe("MAX_LOTS")

    const positions = evaluateOrder(chaseEntryStop(), ctx({ openPositionCount: 12 }))
    expect(positions.ok).toBe(false)
    if (!positions.ok) expect(positions.code).toBe("MAX_POSITIONS")
  })

  it("still allows a protective stop and a flatten while the desk is halted", () => {
    const halted = ctx({
      settings: { ...DEFAULT_RISK_SETTINGS, deskHalted: true, haltReason: "kill" },
    })
    const protective = intent({
      role: inferOrderRole({ purpose: "SL", orderType: "SL" }),
      orderType: "SL",
      strategy: "CHASE",
      tradingsymbol: "NIFTY26OCTFUT",
      side: "SELL",
      product: "NRML",
      tag: "chase",
      quantity: 65,
    })
    expect(evaluateOrder(protective, halted)).toEqual({ ok: true })
    const flatten = intent({
      role: inferOrderRole({ purpose: "FLATTEN", orderType: "MARKET" }),
      orderType: "MARKET",
      strategy: "CHASE",
      tradingsymbol: "NIFTY26OCTFUT",
      side: "SELL",
      product: "NRML",
      tag: "chase",
      quantity: 65,
    })
    expect(evaluateOrder(flatten, halted)).toEqual({ ok: true })
  })

  it("strategy disabled blocks the entry stop and the protective stop", () => {
    const settings = {
      ...DEFAULT_RISK_SETTINGS,
      strategies: {
        ...DEFAULT_RISK_SETTINGS.strategies,
        CHASE: { ...DEFAULT_RISK_SETTINGS.strategies.CHASE, enabled: false },
      },
    }
    const disabled = ctx({ settings })
    const entry = evaluateOrder(chaseEntryStop(), disabled)
    expect(entry.ok).toBe(false)
    if (!entry.ok) expect(entry.code).toBe("STRATEGY_DISABLED")
    const protective = intent({
      role: inferOrderRole({ purpose: "SL", orderType: "SL" }),
      orderType: "SL",
      strategy: "CHASE",
      quantity: 65,
    })
    const stop = evaluateOrder(protective, disabled)
    expect(stop.ok).toBe(false)
    if (!stop.ok) expect(stop.code).toBe("STRATEGY_DISABLED")
  })
})

describe("evaluateOrder", () => {
  it("allows a normal mock entry", () => {
    expect(evaluateOrder(intent(), ctx())).toEqual({ ok: true })
  })

  it("rejects non-integer or non-positive quantity", () => {
    expect(evaluateOrder(intent({ quantity: 0 }), ctx()).ok).toBe(false)
    expect(evaluateOrder(intent({ quantity: 1.5 }), ctx()).ok).toBe(false)
    expect(evaluateOrder(intent({ quantity: -65 }), ctx()).ok).toBe(false)
  })

  it("allows a paper strategy without Desk allowLiveOrders", () => {
    const paper = evaluateOrder(intent(), ctx({ isMock: false, isPaper: true }))
    expect(paper).toEqual({ ok: true })
  })

  it("treats unknown and default strategies as paper", () => {
    expect(isPaperStrategy(DEFAULT_RISK_SETTINGS, "ATM_STRADDLE")).toBe(true)
    expect(isPaperStrategy(DEFAULT_RISK_SETTINGS, "BRAND_NEW")).toBe(true)
    expect(isPaperStrategy(DEFAULT_RISK_SETTINGS, null)).toBe(true)
    const live = {
      ...DEFAULT_RISK_SETTINGS,
      strategies: {
        ...DEFAULT_RISK_SETTINGS.strategies,
        ATM_STRADDLE: {
          ...DEFAULT_RISK_SETTINGS.strategies.ATM_STRADDLE,
          executionMode: "LIVE" as const,
        },
      },
    }
    expect(isPaperStrategy(live, "ATM_STRADDLE")).toBe(false)
    expect(isPaperStrategy(live, "ATM_STRANGLE")).toBe(true)
  })

  it("blocks live entries unless Desk allowLiveOrders is on, but still allows flatten", () => {
    const live = ctx({ isMock: false })
    const blocked = evaluateOrder(intent(), live)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe("LIVE_BLOCKED")

    expect(evaluateOrder(intent({ role: "FLATTEN" }), live)).toEqual({ ok: true })
    expect(evaluateOrder(intent({ role: "SL", orderType: "SL" }), live)).toEqual({ ok: true })

    const allowed = evaluateOrder(
      intent(),
      ctx({
        isMock: false,
        settings: { ...DEFAULT_RISK_SETTINGS, allowLiveOrders: true },
      })
    )
    expect(allowed).toEqual({ ok: true })
  })

  it("rejects new entries when the desk is halted but still allows flatten", () => {
    const halted = ctx({
      settings: { ...DEFAULT_RISK_SETTINGS, deskHalted: true, haltReason: "kill" },
    })
    const entry = evaluateOrder(intent(), halted)
    expect(entry.ok).toBe(false)
    if (!entry.ok) expect(entry.code).toBe("DESK_HALTED")

    expect(evaluateOrder(intent({ role: "FLATTEN" }), halted)).toEqual({ ok: true })
    expect(evaluateOrder(intent({ role: "SL", orderType: "SL" }), halted)).toEqual({ ok: true })
    expect(evaluateOrder(intent({ role: "EXIT" }), halted)).toEqual({ ok: true })
  })

  it("rejects stale prices and invalid LTPs", () => {
    const stale = evaluateOrder(
      intent({ ltpAt: new Date("2026-09-05T09:59:00+05:30") }),
      ctx({ now: new Date("2026-09-05T10:00:00+05:30") })
    )
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.code).toBe("STALE_DATA")

    const invalid = evaluateOrder(intent({ ltp: 0 }), ctx())
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.code).toBe("INVALID_PRICE")
  })

  it("enforces qty, lots, notional, position, order, and rate caps", () => {
    expect(evaluateOrder(intent({ quantity: 2000 }), ctx()).ok).toBe(false)
    expect(evaluateOrder(intent({ lots: 21 }), ctx()).ok).toBe(false)
    expect(evaluateOrder(intent({ quantity: 65, price: 50_000 }), ctx()).ok).toBe(false)
    expect(evaluateOrder(intent(), ctx({ openPositionCount: 12 })).ok).toBe(false)
    expect(evaluateOrder(intent(), ctx({ openOrderCount: 40 })).ok).toBe(false)
    expect(evaluateOrder(intent(), ctx({ recentOrderCount: 20 })).ok).toBe(false)
  })

  it("allows flatten when the open-position cap would block a new entry", () => {
    expect(evaluateOrder(intent(), ctx({ openPositionCount: 12 })).ok).toBe(false)
    expect(evaluateOrder(intent({ role: "FLATTEN" }), ctx({ openPositionCount: 12 }))).toEqual({
      ok: true,
    })
  })

  it("does not skip flatten/SL because of notional, lots, or a stale quote", () => {
    const fat = intent({
      role: "FLATTEN",
      lots: 21,
      ltp: 50_000,
      ltpAt: new Date("2026-09-05T09:00:00+05:30"),
      price: 50_000,
    })
    expect(evaluateOrder(fat, ctx({ now: new Date("2026-09-05T10:00:00+05:30") }))).toEqual({
      ok: true,
    })
    expect(evaluateOrder(intent({ role: "SL", lots: 21, ltp: 0 }), ctx())).toEqual({ ok: true })
    expect(evaluateOrder(intent({ role: "EXIT", ltp: 50_000, price: 50_000 }), ctx())).toEqual({
      ok: true,
    })
  })

  it("applies MAX_NOTIONAL to a MARKET entry when only LTP is present", () => {
    const rejected = evaluateOrder(
      intent({ price: null, triggerPrice: null, ltp: 50_000, quantity: 65 }),
      ctx({ settings: { ...DEFAULT_RISK_SETTINGS, maxNotionalInr: 100 } })
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.code).toBe("MAX_NOTIONAL")
  })

  it("rejects a duplicate working entry", () => {
    const dup = evaluateOrder(intent(), ctx({ pendingDuplicate: true }))
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.code).toBe("DUPLICATE")
  })

  it("rejects aborted jobs, disabled strategies, and closed markets for entries", () => {
    expect(evaluateOrder(intent(), ctx({ jobAborted: true })).ok).toBe(false)
    const settings = {
      ...DEFAULT_RISK_SETTINGS,
      strategies: {
        ...DEFAULT_RISK_SETTINGS.strategies,
        ATM_STRADDLE: { ...DEFAULT_RISK_SETTINGS.strategies.ATM_STRADDLE, enabled: false },
      },
    }
    expect(evaluateOrder(intent({ strategy: "ATM_STRADDLE" }), ctx({ settings })).ok).toBe(false)
    expect(evaluateOrder(intent({ strategy: "CHASE" }), ctx({ settings })).ok).toBe(true)
    expect(
      evaluateOrder(
        intent(),
        ctx({
          isMock: false,
          isPaper: true,
          marketOpen: false,
        })
      )
    ).toEqual({ ok: true })
    expect(
      evaluateOrder(
        intent(),
        ctx({
          isMock: false,
          marketOpen: false,
          settings: { ...DEFAULT_RISK_SETTINGS, allowLiveOrders: true },
        })
      ).ok
    ).toBe(false)
  })

  it("uses per-strategy lot caps so one strategy's limit does not bind another", () => {
    const settings = {
      ...DEFAULT_RISK_SETTINGS,
      strategies: {
        ...DEFAULT_RISK_SETTINGS.strategies,
        ATM_STRADDLE: { ...DEFAULT_RISK_SETTINGS.strategies.ATM_STRADDLE, maxLots: 2 },
        CHASE: { ...DEFAULT_RISK_SETTINGS.strategies.CHASE, maxLots: 10 },
      },
    }
    expect(evaluateOrder(intent({ strategy: "ATM_STRADDLE", lots: 3 }), ctx({ settings })).ok).toBe(
      false
    )
    expect(
      evaluateOrder(intent({ strategy: "CHASE", lots: 3 }), ctx({ settings })).ok
    ).toBe(true)
  })
})

describe("executionProvenance", () => {
  it("uses MOCK when the process flag is on", () => {
    expect(
      executionProvenance({
        processMock: true,
        settings: DEFAULT_RISK_SETTINGS,
        strategy: "CHASE",
      })
    ).toBe("MOCK")
  })

  it("uses PAPER for default Desk executionMode without a restart", () => {
    expect(
      executionProvenance({
        processMock: false,
        settings: DEFAULT_RISK_SETTINGS,
        strategy: "CHASE",
      })
    ).toBe("PAPER")
  })

  it("uses LIVE only when that strategy is LIVE in the DB settings", () => {
    const settings = {
      ...DEFAULT_RISK_SETTINGS,
      strategies: {
        ...DEFAULT_RISK_SETTINGS.strategies,
        CHASE: { ...DEFAULT_RISK_SETTINGS.strategies.CHASE, executionMode: "LIVE" as const },
      },
    }
    expect(executionProvenance({ processMock: false, settings, strategy: "CHASE" })).toBe("LIVE")
    expect(executionProvenance({ processMock: false, settings, strategy: "ATM_STRADDLE" })).toBe(
      "PAPER"
    )
  })
})

describe("stored job lots", () => {
  it("uses the lots stored on the job when the caller sends a smaller number", () => {
    expect(lotsForRiskCheck(1, 2)).toBe(2)
    expect(lotsForRiskCheck(null, 1)).toBe(1)
    expect(lotsForRiskCheck(3, null)).toBe(3)
  })

  it("rejects an entry whose quantity is larger than the stored lots", () => {
    const decision = evaluateOrder(
      intent({ quantity: 130, lots: 1, lotSize: 65, ltp: 10 }),
      ctx()
    )
    expect(decision.ok).toBe(false)
    if (!decision.ok) expect(decision.code).toBe("JOB_LOTS")
  })

  it("allows a flatten larger than the stored lots", () => {
    const decision = evaluateOrder(
      intent({ role: "FLATTEN", quantity: 130, lots: 1, lotSize: 65, ltp: 10 }),
      ctx()
    )
    expect(decision.ok).toBe(true)
  })

  it("allows an entry at the stored lot size", () => {
    const decision = evaluateOrder(intent({ quantity: 65, lots: 1, lotSize: 65, ltp: 10 }), ctx())
    expect(decision.ok).toBe(true)
  })
})
