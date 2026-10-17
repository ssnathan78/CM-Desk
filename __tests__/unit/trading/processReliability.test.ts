import { pendingMigrationTags, resolveMigrationsFolder } from "../../../lib/migrationGate.js"
import { chaseStopTouchedInWindow, mayResetEmptyChaseStatus } from "../../../lib/chaseFill"
import { isLateTradingJob, LATE_ENTRY_GRACE_MS } from "../../../lib/queue-processor/staleJobGuard"
import {
  decideBrokerPlace,
  followUpJobId,
  isAmbiguousBrokerError,
  isDuplicateJobError,
  matchingBrokerOrderId,
  OrderAckUnknownError,
  workingEntryCount,
} from "../../../lib/trading/brokerPlace"
import {
  chaseSchedulerEndStillOpen,
  jobNeedsReconcile,
  templateBlockedByJob,
} from "../../../lib/trading/scheduleGuard"
import dayjs from "dayjs"

describe("broker place decisions", () => {
  it("places a newly saved intent", () => {
    expect(
      decideBrokerPlace({
        created: true,
        status: "PENDING",
        brokerOrderId: null,
        ageMs: 0,
      })
    ).toEqual({ action: "place" })
  })

  it("reuses a working order that already has a broker id", () => {
    expect(
      decideBrokerPlace({
        created: false,
        status: "SUBMITTED",
        brokerOrderId: "kite-1",
        ageMs: 5_000,
      })
    ).toEqual({ action: "reuse", brokerOrderId: "kite-1" })
  })

  it("looks up the broker book before placing when the ack was never stored", () => {
    expect(
      decideBrokerPlace({
        created: false,
        status: "PENDING",
        brokerOrderId: null,
        ageMs: 1_000,
      })
    ).toEqual({ action: "lookup" })
  })

  it("waits when the book does not show the order yet", () => {
    expect(
      decideBrokerPlace({
        created: false,
        status: "UNKNOWN",
        brokerOrderId: null,
        ageMs: 10_000,
        brokerOrderIdFromBook: null,
      })
    ).toEqual({ action: "wait" })
  })

  it("places on the same row only after the ack window when the book is still empty", () => {
    expect(
      decideBrokerPlace({
        created: false,
        status: "UNKNOWN",
        brokerOrderId: null,
        ageMs: 61_000,
        brokerOrderIdFromBook: null,
      })
    ).toEqual({ action: "place" })
  })

  it("attaches a broker id found on the book", () => {
    expect(
      decideBrokerPlace({
        created: false,
        status: "PENDING",
        brokerOrderId: null,
        ageMs: 2_000,
        brokerOrderIdFromBook: "kite-9",
      })
    ).toEqual({ action: "reuse", brokerOrderId: "kite-9" })
  })

  it("treats a network failure as ambiguous and a clear reject as final", () => {
    expect(isAmbiguousBrokerError({ error_type: "NetworkException", message: "timeout" })).toBe(
      true
    )
    expect(isAmbiguousBrokerError(new OrderAckUnknownError())).toBe(true)
    expect(isAmbiguousBrokerError({ error_type: "OrderException", message: "Insufficient funds" })).toBe(
      false
    )
    expect(isAmbiguousBrokerError({ error_type: "InputException", message: "invalid" })).toBe(false)
  })

  it("matches the same broker instruction and ignores a different symbol", () => {
    const orders = [
      {
        order_id: "a",
        tag: "tag1",
        tradingsymbol: "NIFTY26OCTFUT",
        quantity: 65,
        transaction_type: "BUY",
        product: "NRML",
        exchange: "NFO",
        order_type: "MARKET",
      },
    ]
    expect(
      matchingBrokerOrderId(orders, {
        tag: "tag1",
        tradingsymbol: "NIFTY26OCTFUT",
        quantity: 65,
        transaction_type: "BUY",
        product: "NRML",
        exchange: "NFO",
        order_type: "MARKET",
      })
    ).toBe("a")
    expect(
      matchingBrokerOrderId(orders, {
        tag: "tag1",
        tradingsymbol: "BANKNIFTY26OCTFUT",
        quantity: 65,
        transaction_type: "BUY",
      })
    ).toBeNull()
  })

  it("keeps an unsliced intent key stable and distinguishes freeze slices", () => {
    const { orderIntentKey } = jest.requireActual("../../../lib/trading/ledger") as {
      orderIntentKey: (input: {
        tag?: string | null
        tradingsymbol: string
        side: "BUY" | "SELL"
        quantity: number
        purpose: "ENTRY"
        orderType?: string | null
        slice?: string | null
      }) => string
    }
    const base = {
      tag: "abc",
      tradingsymbol: "NIFTY26OCT24500CE",
      side: "SELL" as const,
      quantity: 1800,
      purpose: "ENTRY" as const,
      orderType: "MARKET",
    }
    expect(orderIntentKey(base)).toBe("intent:abc:NIFTY26OCT24500CE:SELL:1800:ENTRY:MARKET::")
    expect(orderIntentKey({ ...base, slice: "0" })).not.toBe(orderIntentKey({ ...base, slice: "1" }))
    expect(orderIntentKey({ ...base, slice: "0" })).not.toBe(orderIntentKey(base))
  })
})

describe("entry schedule and follow-up identity", () => {
  it("discards a same-day entry that is later than the grace, and keeps Run now", () => {
    const now = dayjs("2026-10-17T14:00:00+05:30")
    const scheduled = dayjs("2026-10-17T09:20:00+05:30").valueOf()
    expect(isLateTradingJob(scheduled, 0, now)).toBe(true)
    expect(isLateTradingJob(now.valueOf(), 0, now)).toBe(false)
    expect(isLateTradingJob(now.valueOf() - LATE_ENTRY_GRACE_MS + 1000, 0, now)).toBe(false)
  })

  it("uses one follow-up id per execution and treats a duplicate add as success", () => {
    expect(followUpJobId("exit", "job-1")).toBe("exit-job-1")
    expect(followUpJobId("aso", "job-1")).toBe("aso-job-1")
    expect(isDuplicateJobError(new Error("Job is already waiting"))).toBe(true)
    expect(isDuplicateJobError(new Error("redis down"))).toBe(false)
  })

  it("hides a finished template and shows a failed one again", () => {
    expect(templateBlockedByJob("COMPLETED")).toBe(true)
    expect(templateBlockedByJob("PENDING")).toBe(true)
    expect(templateBlockedByJob("FAILED")).toBe(false)
    expect(templateBlockedByJob("REJECT")).toBe(false)
    const end = new Date("2026-10-17T15:30:00+05:30")
    expect(chaseSchedulerEndStillOpen(end, new Date("2026-10-17T15:29:00+05:30"))).toBe(true)
    expect(chaseSchedulerEndStillOpen(end, new Date("2026-10-17T15:30:00+05:30"))).toBe(false)
    expect(chaseSchedulerEndStillOpen(end, new Date("2026-10-17T23:40:00+05:30"))).toBe(false)
  })

  it("fails a stuck pending row and leaves a young queue row alone", () => {
    expect(
      jobNeedsReconcile({
        status: "PENDING",
        ageMs: 3 * 60 * 1000,
        hasQueueId: false,
      })
    ).toBe("fail")
    expect(
      jobNeedsReconcile({
        status: "QUEUE",
        ageMs: 30_000,
        hasQueueId: true,
        queueJobMissing: true,
      })
    ).toBe("keep")
    expect(
      jobNeedsReconcile({
        status: "QUEUE",
        ageMs: 3 * 60 * 1000,
        hasQueueId: true,
        queueJobMissing: true,
      })
    ).toBe("fail")
    expect(
      jobNeedsReconcile({
        status: "QUEUE",
        ageMs: 3 * 60 * 1000,
        hasQueueId: true,
        queueType: "chase",
        queueJobMissing: true,
      })
    ).toBe("keep")
  })
})

describe("chase restart boundaries", () => {
  it("does not clear LONG when Kite quantity is unknown", () => {
    expect(
      mayResetEmptyChaseStatus({ sync: "reset_empty", paperBook: false, kiteQtyKnown: false })
    ).toBe(false)
    expect(
      mayResetEmptyChaseStatus({ sync: "reset_empty", paperBook: false, kiteQtyKnown: true })
    ).toBe(true)
    expect(
      mayResetEmptyChaseStatus({ sync: "reset_empty", paperBook: true, kiteQtyKnown: false })
    ).toBe(true)
    expect(mayResetEmptyChaseStatus({ sync: "hold", paperBook: false, kiteQtyKnown: true })).toBe(
      false
    )
  })

  it("sees a stop touch in an earlier candle of the window", () => {
    expect(
      chaseStopTouchedInWindow({
        side: "LONG",
        stoploss: 24000,
        candles: [
          { high: 24100, low: 23950 },
          { high: 24200, low: 24110 },
        ],
      })
    ).toBe(true)
    expect(
      chaseStopTouchedInWindow({
        side: "SHORT",
        stoploss: 24200,
        candles: [
          { high: 24220, low: 24100 },
          { high: 24150, low: 24080 },
        ],
      })
    ).toBe(true)
    expect(
      chaseStopTouchedInWindow({
        side: "LONG",
        stoploss: 24000,
        candles: [{ high: 24100, low: 24010 }],
      })
    ).toBe(false)
  })
})

describe("daily trend working entry", () => {
  it("counts a working buy and ignores a working stop", () => {
    const orders = [
      { tradingsymbol: "RELIANCE", strategy: "DAILY_TREND", purpose: "ENTRY", status: "SUBMITTED" },
      { tradingsymbol: "RELIANCE", strategy: "DAILY_TREND", purpose: "SL", status: "ACCEPTED" },
      { tradingsymbol: "TCS", strategy: "DAILY_TREND", purpose: "ENTRY", status: "FILLED" },
    ]
    expect(workingEntryCount(orders, "RELIANCE", "DAILY_TREND")).toBe(1)
    expect(workingEntryCount(orders, "TCS", "DAILY_TREND")).toBe(0)
  })
})

describe("migration gate", () => {
  const entries = [
    { tag: "0000_init", when: 1 },
    { tag: "0001_next", when: 2 },
  ]

  it("treats an empty migrations table as fully pending", () => {
    expect(pendingMigrationTags(entries, [])).toEqual(["0000_init", "0001_next"])
  })

  it("returns only journal entries newer than the last applied millis", () => {
    expect(pendingMigrationTags(entries, [1])).toEqual(["0001_next"])
    expect(pendingMigrationTags(entries, [2])).toEqual([])
  })

  it("uses the working directory when that journal exists", () => {
    let calls = 0
    const folder = resolveMigrationsFolder(undefined, () => {
      calls += 1
      return calls === 1
    })
    expect(calls).toBe(1)
    expect(folder.replace(/\\/g, "/")).toMatch(/drizzle$/)
  })

  it("falls through when the working directory has no journal", () => {
    let calls = 0
    const folder = resolveMigrationsFolder(undefined, () => {
      calls += 1
      return calls === 2
    })
    expect(calls).toBe(2)
    expect(folder.replace(/\\/g, "/")).toMatch(/drizzle$/)
  })
})
