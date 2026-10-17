import dayjs from "dayjs"

import { isStaleTradingJob } from "../../lib/queue-processor/staleJobGuard"

describe("tradingQueue stale job guard", () => {
  it("discards jobs scheduled on a previous calendar day", () => {
    const yesterday = dayjs().subtract(1, "day").valueOf()
    expect(isStaleTradingJob(yesterday)).toBe(true)
  })

  it("accepts jobs scheduled today", () => {
    const today = dayjs().valueOf()
    expect(isStaleTradingJob(today)).toBe(false)
  })

  it("respects delay when computing scheduled day", () => {
    const lateYesterday = dayjs().startOf("day").subtract(1, "hour").valueOf()
    const delay = 2 * 60 * 60 * 1000
    expect(isStaleTradingJob(lateYesterday, delay)).toBe(false)
  })
})

jest.mock("../../lib/jobControl", () => ({
  abortTodaysJobExecutions: jest
    .fn()
    .mockResolvedValue([{ orderTag: "t1", strategy: "ATM_STRADDLE" }]),
}))

jest.mock("../../lib/chaseSettings", () => ({
  saveChaseSettings: jest.fn().mockResolvedValue({ paused: true, lots: 1 }),
  pauseAllChaseBooks: jest.fn().mockResolvedValue(undefined),
  listChaseBooks: jest.fn().mockResolvedValue([{ instrument: "NIFTY" }]),
}))

jest.mock("../../lib/drizzleDbUtils", () => ({
  getLatestAccessToken: jest.fn(),
  storeAccessToken: jest.fn(),
  updateChaseStatus: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../lib/exit-strategies/autoSquareOff", () => ({
  squareOffTag: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../lib/flattenOpen", () => ({
  flattenOpenPositions: jest.fn().mockResolvedValue({
    flattened: [],
    skipped: [],
    abortedJobs: [],
    chaseReset: [],
  }),
}))

jest.mock("../../lib/trading/riskSettings", () => ({
  haltDesk: jest.fn().mockResolvedValue({}),
}))

describe("killDesk runDeskKill", () => {
  it("intraday scope does not pause chase", async () => {
    const { runDeskKill } = await import("../../lib/killDesk")
    const { createTestUser } = await import("../support/sessionFactory")
    const result = await runDeskKill("intraday", createTestUser())
    expect(result.scope).toBe("intraday")
    expect(result.chasePaused).toBe(false)
    expect(result.aborted).toBe(1)
  })

  it("all scope pauses chase under mock orders", async () => {
    const { runDeskKill } = await import("../../lib/killDesk")
    const { createTestUser } = await import("../support/sessionFactory")
    const result = await runDeskKill("all", createTestUser())
    expect(result.chasePaused).toBe(true)
    expect(result.liveLeftOpen).toBe(false)
  })

  it("all scope keeps Chase LONG or SHORT when a live flatten was refused", async () => {
    const { flattenOpenPositions } = await import("../../lib/flattenOpen")
    const { LIVE_FLATTEN_MARKET_CLOSED } = await import("../../lib/flattenNotice")
    const mocked = flattenOpenPositions as jest.Mock
    mocked.mockResolvedValueOnce({
      flattened: [],
      skipped: [{ tradingsymbol: "NIFTY26OCTFUT", reason: LIVE_FLATTEN_MARKET_CLOSED }],
      abortedJobs: [],
      chaseReset: [],
    })
    const { updateChaseStatus } = await import("../../lib/drizzleDbUtils")
    const update = updateChaseStatus as jest.Mock
    update.mockClear()
    const { runDeskKill } = await import("../../lib/killDesk")
    const { createTestUser } = await import("../support/sessionFactory")
    const result = await runDeskKill("all", createTestUser())
    expect(result.liveLeftOpen).toBe(true)
    expect(result.chasePaused).toBe(true)
    expect(result.deskHalted).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it("does not claim Chase is paused when the pause fails", async () => {
    const { pauseAllChaseBooks } = await import("../../lib/chaseSettings")
    const pause = pauseAllChaseBooks as jest.Mock
    pause.mockRejectedValueOnce(new Error("db down"))
    const { runDeskKill } = await import("../../lib/killDesk")
    const { createTestUser } = await import("../support/sessionFactory")
    const result = await runDeskKill("all", createTestUser())
    expect(result.chasePaused).toBe(false)
    expect(result.deskHalted).toBe(true)
  })

  it("reports flattenFailed when the flatten call throws and still records the halt", async () => {
    const { flattenOpenPositions } = await import("../../lib/flattenOpen")
    const mocked = flattenOpenPositions as jest.Mock
    mocked.mockRejectedValueOnce(new Error("kite down"))
    const { runDeskKill } = await import("../../lib/killDesk")
    const { createTestUser } = await import("../support/sessionFactory")
    const result = await runDeskKill("intraday", createTestUser())
    expect(result.flattenFailed).toBe(true)
    expect(result.deskHalted).toBe(true)
    expect(result.liveLeftOpen).toBe(false)
  })

  it("does not claim the desk is halted when the halt fails", async () => {
    const { haltDesk } = await import("../../lib/trading/riskSettings")
    const halt = haltDesk as jest.Mock
    halt.mockRejectedValueOnce(new Error("db down"))
    const { runDeskKill } = await import("../../lib/killDesk")
    const { createTestUser } = await import("../support/sessionFactory")
    const result = await runDeskKill("intraday", createTestUser())
    expect(result.deskHalted).toBe(false)
    expect(result.chasePaused).toBe(false)
  })
})

describe("chaseBooksKeptOpen", () => {
  it("keeps the open Chase book and still resets a different flat book", async () => {
    const { chaseBooksKeptOpen } = await import("../../lib/killDesk")
    const { LIVE_FLATTEN_MARKET_CLOSED } = await import("../../lib/flattenNotice")
    const kept = chaseBooksKeptOpen(
      ["NIFTY", "BANKNIFTY", "RELIANCE"],
      [
        { tradingsymbol: "NIFTY26OCTFUT", reason: LIVE_FLATTEN_MARKET_CLOSED },
        { tradingsymbol: "RELIANCE26OCTFUT", reason: LIVE_FLATTEN_MARKET_CLOSED },
      ],
      []
    )
    expect([...kept].sort()).toEqual(["NIFTY", "RELIANCE"])
  })
})

describe("utils isMockOrder", () => {
  it("returns true in test env", async () => {
    const { isMockOrder } = await import("../../lib/utils")
    expect(isMockOrder()).toBe(true)
  })
})
