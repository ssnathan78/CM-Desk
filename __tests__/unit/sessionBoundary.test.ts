import { safeErrorMessage } from "../../lib/apiErrors"
import { chaseResetRefusal } from "../../lib/chaseReset"
import {
  mapJobExecutionQueuePayload,
  pendingJobFieldChange,
} from "../../lib/jobExecutionMapper"
import {
  ALLOW_LIVE_CONFIRM,
  allowLiveArm,
  confirmationError,
  KILL_ALL_CONFIRM,
  killConfirmPhrase,
  SQUARE_OFF_CONFIRM,
} from "../../lib/operatorConfirm"
import { collectPlanExtras } from "../../lib/planMapper"
import { reconcileTargetTied } from "../../lib/trading/strategyReconcile"

describe("queued job payload", () => {
  const stored = {
    id: "job-1",
    strategy: "ATM_STRADDLE",
    lots: 1,
    productType: "MIS",
    instrument: "NIFTY",
    volatilityType: "SHORT",
    exitStrategy: "NO_SL",
  }

  it("keeps stored lots, strategy, product, and direction when extras tries to replace them", () => {
    const payload = mapJobExecutionQueuePayload(
      {
        strategy: "ATM_STRADDLE",
        lots: 1,
        extras: {
          lots: 27,
          strategy: "ATM_STRANGLE",
          productType: "NRML",
          volatilityType: "LONG",
          purpose: "FLATTEN",
          quantity: 1755,
        },
      },
      stored,
      "tag-1"
    )
    expect(payload.lots).toBe(1)
    expect(payload.strategy).toBe("ATM_STRADDLE")
    expect(payload.productType).toBe("MIS")
    expect(payload.volatilityType).toBe("SHORT")
    expect(payload.instrument).toBe("NIFTY")
    expect(payload.purpose).toBeUndefined()
    expect(payload.quantity).toBeUndefined()
    expect(payload.orderTag).toBe("tag-1")
  })

  it("still copies hedge fields from extras", () => {
    expect(
      collectPlanExtras({
        extras: { lots: 9, strategy: "CHASE", isHedgeEnabled: true, hedgeDistance: 5 },
      })
    ).toEqual({ isHedgeEnabled: true, hedgeDistance: 5 })
  })
})

describe("pending job identity", () => {
  const current = {
    strategy: "ATM_STRADDLE",
    lots: 1,
    productType: "MIS",
    instrument: "NIFTY",
    volatilityType: "SHORT",
  }

  it("refuses a strategy, lots, or product change", () => {
    expect(pendingJobFieldChange(current, { strategy: "ATM_STRANGLE" })).toMatch(/strategy/)
    expect(pendingJobFieldChange(current, { lots: 20 })).toMatch(/lots/)
    expect(pendingJobFieldChange(current, { productType: "NRML" })).toMatch(/productType/)
  })

  it("allows an exit-field edit that leaves identity alone", () => {
    expect(pendingJobFieldChange(current, { slmPercent: 30, strategy: "ATM_STRADDLE" })).toBeNull()
  })
})

describe("destructive confirms", () => {
  it("requires the phrase before Allow live orders can turn on", () => {
    expect(allowLiveArm({ current: false, requested: true, confirm: undefined }).ok).toBe(false)
    expect(allowLiveArm({ current: false, requested: true, confirm: ALLOW_LIVE_CONFIRM }).ok).toBe(
      true
    )
    expect(allowLiveArm({ current: true, requested: true, confirm: undefined }).ok).toBe(true)
    expect(allowLiveArm({ current: false, requested: false, confirm: undefined }).ok).toBe(true)
  })

  it("uses a different phrase for kill all and square off", () => {
    expect(killConfirmPhrase("all")).toBe(KILL_ALL_CONFIRM)
    expect(killConfirmPhrase("intraday")).not.toBe(KILL_ALL_CONFIRM)
    expect(confirmationError(SQUARE_OFF_CONFIRM)).toContain(SQUARE_OFF_CONFIRM)
  })
})

describe("chase reset", () => {
  it("refuses an open book and an unknown quantity", () => {
    expect(chaseResetRefusal({ status: "LONG", netQty: 65, qtyKnown: true })).toMatch(/open book/)
    expect(chaseResetRefusal({ status: "SHORT", netQty: null, qtyKnown: false })).toMatch(/flat/)
    expect(chaseResetRefusal({ status: "LONG", netQty: 0, qtyKnown: true })).toBeNull()
    expect(chaseResetRefusal({ status: "AWAITING_SIGNAL", netQty: 65, qtyKnown: true })).toBeNull()
  })
})

describe("reconcile attribution", () => {
  it("accepts a strategy that already has size or a prior order", () => {
    expect(reconcileTargetTied({ strategyQty: 0, priorTouches: 0 })).toBe(false)
    expect(reconcileTargetTied({ strategyQty: 10, priorTouches: 0 })).toBe(true)
    expect(reconcileTargetTied({ strategyQty: 0, priorTouches: 1 })).toBe(true)
  })
})

describe("safeErrorMessage", () => {
  const prev = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = prev
  })

  it("hides query text and bound parameters in production", () => {
    process.env.NODE_ENV = "production"
    const err = new Error('Failed query: select * from accesstoken\nparams: ["token-value"]')
    expect(safeErrorMessage(err)).toBe("Internal server error")
    expect(safeErrorMessage(err)).not.toMatch(/select|token-value|params/i)
  })

  it("keeps a short application message", () => {
    process.env.NODE_ENV = "production"
    expect(safeErrorMessage(new Error("Kite positions unavailable"))).toBe(
      "Kite positions unavailable"
    )
  })
})
