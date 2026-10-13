import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  applyDailyTrendBulk,
  completedDailyBars,
  emaFromCloses,
  evaluateDailyLong,
  parseDailyTrendBulkPatch,
  sharesForBudget,
} from "../../lib/dailyTrend/engine"
import { parseScreenerMarketCapCr } from "../../lib/dailyTrend/marketCap"
import { loadNifty100 } from "../../lib/dailyTrend/nifty100"
import { buildMomentumPlan, executableOrders, metricsFromBars } from "../../lib/momentum/engine"
import { firstTradingSessionOfMonth } from "../../lib/momentum/calendar"
import {
  DEFAULT_MOMENTUM_CONFIG,
  dataPullAllowed,
  normalizeMomentumConfig,
  ordersAllowed,
  rebalanceDue,
} from "../../lib/momentum/types"
import { parseUniverseCsv } from "../../lib/momentum/universe"
import { normalizeNseCashSymbol, searchNseCashNames } from "../../lib/nseCashSymbol"

function passing(symbol: string, score: number, price = 100) {
  return {
    symbol,
    price,
    metrics: {
      score,
      roc12: 0.25,
      roc24: 0.4,
      roc1: 0.04,
      pctBelowHigh: 4,
      aboveSma: true,
      avgTurnoverInr: 20_000_000,
      circuitCount12m: 1,
      marketCapCr: 5000,
    },
  }
}

const config = {
  ...DEFAULT_MOMENTUM_CONFIG,
  active: true,
  holdingsCount: 2,
  worstRankHeld: 3,
  entryRankMax: 2,
  capitalInr: 100_000,
  maxWeightPct: 50,
}

describe("momentum rank and rebalance", () => {
  it("keeps the original rank when a higher score fails a filter", () => {
    const plan = buildMomentumPlan({
      config,
      holdings: [],
      locks: [],
      symbols: [
        passing("AAA", 3, 100),
        passing("BBB", 2, 100),
        { ...passing("CCC", 1, 100), metrics: { ...passing("CCC", 1).metrics, aboveSma: false } },
      ],
    })
    const aaa = plan.ranked.find(row => row.symbol === "AAA")
    expect(aaa?.rank).toBe(1)
    expect(aaa?.filterPass).toBe(true)
    expect(plan.targets.map(row => row.symbol)).toEqual(["AAA", "BBB"])
    expect(plan.ranked.find(row => row.symbol === "CCC")?.rank).toBe(3)
  })

  it("holds a name through WRH and does not replace it with a fresh leader when the book is full", () => {
    const plan = buildMomentumPlan({
      config: { ...config, holdingsCount: 1, entryRankMax: 1, worstRankHeld: 3 },
      holdings: [{ symbol: "CCC", quantity: 10 }],
      locks: [],
      symbols: [passing("AAA", 3), passing("BBB", 2), passing("CCC", 1)],
    })
    expect(plan.targets.map(row => row.symbol)).toEqual(["CCC"])
    expect(plan.orders.find(order => order.symbol === "AAA")).toBeUndefined()
  })

  it("sells a held name that fails a filter and does not buy more than the open book on the way out", () => {
    const plan = buildMomentumPlan({
      config,
      holdings: [{ symbol: "AAA", quantity: 12 }],
      locks: [],
      symbols: [
        { ...passing("AAA", 3), metrics: { ...passing("AAA", 3).metrics, aboveSma: false } },
        passing("BBB", 2),
        passing("CCC", 1),
      ],
    })
    const sell = plan.orders.find(order => order.symbol === "AAA" && order.side === "SELL")
    expect(sell?.quantity).toBe(12)
    expect(plan.orders.find(order => order.symbol === "AAA" && order.side === "BUY")).toBeUndefined()
  })

  it("does not top a hold-weight lock back up to equal weight", () => {
    const plan = buildMomentumPlan({
      config,
      holdings: [{ symbol: "AAA", quantity: 40 }],
      locks: [{ symbol: "AAA", mode: "HOLD_WEIGHT", weightPct: 10 }],
      symbols: [passing("AAA", 3), passing("BBB", 2)],
    })
    const aaa = plan.targets.find(row => row.symbol === "AAA")
    expect(aaa?.targetQty).toBeLessThanOrEqual(40)
    expect(plan.orders.find(order => order.symbol === "AAA" && order.side === "BUY")).toBeUndefined()
  })

  it("excludes a name and sells the open quantity", () => {
    const plan = buildMomentumPlan({
      config,
      holdings: [{ symbol: "AAA", quantity: 15 }],
      locks: [{ symbol: "AAA", mode: "EXCLUDE", weightPct: 0 }],
      symbols: [passing("AAA", 3), passing("BBB", 2)],
    })
    expect(plan.targets.find(row => row.symbol === "AAA")).toBeUndefined()
    expect(plan.orders.find(order => order.symbol === "AAA")).toMatchObject({ side: "SELL", quantity: 15 })
  })

  it("sizes from capital and never buys when capital is zero", () => {
    const plan = buildMomentumPlan({
      config: { ...config, capitalInr: 0 },
      holdings: [],
      locks: [],
      symbols: [passing("AAA", 3), passing("BBB", 2)],
    })
    expect(plan.orders).toEqual([])
  })

  it("does not emit orders in report mode or in manual mode without a request", () => {
    const plan = buildMomentumPlan({
      config,
      holdings: [],
      locks: [],
      symbols: [passing("AAA", 2), passing("BBB", 1)],
    })
    expect(executableOrders(plan, { execution: "report", executeRequested: true, due: true })).toEqual([])
    expect(executableOrders(plan, { execution: "manual", executeRequested: false, due: true })).toEqual([])
    expect(
      executableOrders(plan, { execution: "auto", executeRequested: false, due: true }).length
    ).toBeGreaterThan(0)
  })

  it("fails closed when 12-month history is missing", () => {
    const metrics = metricsFromBars(
      [{ date: "2026-01-01", open: 1, high: 1, low: 1, close: 1, volume: 100 }],
      "SHARPE_12M",
      200
    )
    expect(metrics.score).toBeNull()
    expect(metrics.roc12).toBeNull()
  })
})

describe("NSE cash symbols", () => {
  it("accepts M&M and rejects a leading digit", () => {
    expect(normalizeNseCashSymbol("m&m")).toBe("M&M")
    expect(normalizeNseCashSymbol(" niftybees ")).toBe("NIFTYBEES")
    expect(normalizeNseCashSymbol("123")).toBeNull()
    expect(normalizeNseCashSymbol("")).toBeNull()
  })

  it("matches a company name and prefers a symbol prefix", () => {
    const found = searchNseCashNames(
      [
        { symbol: "RELIANCE", name: "RELIANCE INDUSTRIES" },
        { symbol: "M&M", name: "MAHINDRA & MAHINDRA" },
        { symbol: "M&MFIN", name: "MAHINDRA & MAHINDRA FIN" },
      ],
      "mahindra"
    )
    expect(found.map(row => row.symbol)).toEqual(["M&M", "M&MFIN"])
  })
})

describe("Nifty 100 seed list", () => {
  it("has one hundred names, including M&M, with a market-cap snapshot", () => {
    const rows = loadNifty100()
    expect(rows).toHaveLength(100)
    expect(rows.some(row => row.symbol === "M&M")).toBe(true)
    const reliance = rows.find(row => row.symbol === "RELIANCE")
    expect(reliance?.marketCapCr).toBeGreaterThan(100_000)
    expect(reliance?.name.toLowerCase()).toContain("reliance")
  })
})

describe("momentum switches", () => {
  it("defaults to off, report-only, and no data pull", () => {
    const next = normalizeMomentumConfig({})
    expect(next.active).toBe(false)
    expect(next.execution).toBe("report")
    expect(dataPullAllowed(next)).toBe(false)
    expect(ordersAllowed({ execution: next.execution, executeRequested: true, due: true })).toBe(false)
  })

  it("treats ad hoc as never due and weekly as the configured weekday", () => {
    expect(rebalanceDue({ ...config, rebalance: "adhoc" }, { isoWeekday: 1, firstSessionOfMonth: true })).toBe(
      false
    )
    expect(rebalanceDue({ ...config, rebalance: "weekly", weeklyDay: 3 }, { isoWeekday: 3, firstSessionOfMonth: false })).toBe(
      true
    )
    expect(rebalanceDue({ ...config, active: false }, { isoWeekday: 1, firstSessionOfMonth: true })).toBe(false)
  })

  it("ignores a stored strict circuit filter because Kite has no circuit count", () => {
    const stored = normalizeMomentumConfig({
      ...config,
      filters: { ...config.filters, circuitFilter: "strict", maxCircuits12m: 0 },
    })
    expect(stored.filters.circuitFilter).toBe("off")
    const plan = buildMomentumPlan({
      config: {
        ...config,
        filters: { ...config.filters, circuitFilter: "strict", maxCircuits12m: 0 },
      },
      holdings: [],
      locks: [],
      symbols: [{ ...passing("AAA", 3), metrics: { ...passing("AAA", 3).metrics, circuitCount12m: null } }],
    })
    expect(plan.ranked[0]?.filterPass).toBe(true)
    expect(plan.ranked[0]?.filterReasons.join(" ")).not.toMatch(/circuit/i)
  })

  it("loads the bundled universe and knows the first session of a month", () => {
    const text = readFileSync(resolve(process.cwd(), "data/universe/nifty-total-market.csv"), "utf8")
    const rows = parseUniverseCsv(text)
    expect(rows.length).toBeGreaterThan(700)
    expect(rows.some(row => row.symbol === "RELIANCE")).toBe(true)
    expect(rows.some(row => row.symbol === "M&M")).toBe(true)
    expect(firstTradingSessionOfMonth(new Date("2026-09-01T04:00:00Z"))).toBe(true)
    expect(firstTradingSessionOfMonth(new Date("2026-09-02T04:00:00Z"))).toBe(false)
  })
})

describe("daily long-only trend", () => {
  it("applies only the filled settings and leaves a long book's stop alone", () => {
    const book = {
      symbol: "ABB",
      enabled: true,
      paused: true,
      emaPeriod: 40,
      bufferPercent: 1,
      exitBufferPercent: 1,
      budgetInr: 0,
      entryStyle: "CLOSE_CROSS" as const,
      status: "LONG" as const,
      stop: 2400,
      entry: 2500,
      quantity: 12,
    }
    expect(parseDailyTrendBulkPatch({})).toEqual({
      ok: false,
      error: "Fill at least one field to apply to every symbol",
    })
    expect(parseDailyTrendBulkPatch({ emaPeriod: 1 }).ok).toBe(false)
    const parsed = parseDailyTrendBulkPatch({ emaPeriod: "50", budgetInr: "100000" })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const next = applyDailyTrendBulk(book, parsed.patch)
    expect(next).toMatchObject({
      emaPeriod: 50,
      budgetInr: 100000,
      bufferPercent: 1,
      enabled: true,
      paused: true,
      status: "LONG",
      stop: 2400,
      entry: 2500,
      quantity: 12,
    })
  })

  it("drops today's bar and sizes a buy from the rupee budget", () => {
    const bars = completedDailyBars(
      [
        { date: "2026-10-13", close: 100 },
        { date: "2026-10-14", close: 130 },
      ],
      "2026-10-14"
    )
    expect(bars.map(bar => bar.close)).toEqual([100])
    expect(sharesForBudget(100_000, 250)).toBe(400)
    expect(sharesForBudget(0, 250)).toBe(0)
    expect(
      parseScreenerMarketCapCr('<span class="name">Market Cap</span><span class="number">15,78,705</span>')
    ).toBe(1578705)
  })

  const trend = {
    emaPeriod: 3,
    bufferPercent: 1,
    exitBufferPercent: 1,
    entryStyle: "CLOSE_CROSS" as const,
    quantity: 7,
  }

  it("buys the configured quantity on a close through the band and does not call that state long", () => {
    const decision = evaluateDailyLong({
      ema: 100,
      bar: { high: 110, low: 101, close: 108 },
      state: "FLAT",
      bookQty: 0,
      stop: null,
      entry: null,
      config: trend,
    })
    expect(decision.action).toBe("BUY")
    expect(decision.quantity).toBe(7)
    expect(decision.state).toBe("PENDING_LONG")
  })

  it("sells the open quantity through the stop and does nothing when the book is already flat", () => {
    const held = evaluateDailyLong({
      ema: 100,
      bar: { high: 99, low: 90, close: 92 },
      state: "LONG",
      bookQty: 4,
      stop: 95,
      entry: 110,
      config: trend,
    })
    expect(held).toMatchObject({ action: "SELL", quantity: 4, role: "SL" })
    const flat = evaluateDailyLong({
      ema: 100,
      bar: { high: 99, low: 90, close: 92 },
      state: "LONG",
      bookQty: 0,
      stop: 95,
      entry: 110,
      config: trend,
    })
    expect(flat.action).toBe("NONE")
    expect(flat.quantity).toBe(0)
  })

  it("flattens a short instead of adding a long", () => {
    const decision = evaluateDailyLong({
      ema: 100,
      bar: { high: 110, low: 100, close: 108 },
      state: "FLAT",
      bookQty: -3,
      stop: null,
      entry: null,
      config: trend,
    })
    expect(decision).toMatchObject({ action: "BUY", quantity: 3, role: "FLATTEN" })
  })

  it("waits for the prior high when entry is a break", () => {
    const pending = evaluateDailyLong({
      ema: 100,
      bar: { high: 110, low: 101, close: 108 },
      state: "FLAT",
      bookQty: 0,
      stop: null,
      entry: null,
      config: { ...trend, entryStyle: "BREAK_HIGH" },
    })
    expect(pending.action).toBe("NONE")
    expect(pending.entry).toBe(110)
    const broken = evaluateDailyLong({
      ema: 100,
      bar: { high: 111, low: 105, close: 109 },
      state: "PENDING_LONG",
      bookQty: 0,
      stop: pending.stop,
      entry: pending.entry,
      config: { ...trend, entryStyle: "BREAK_HIGH" },
    })
    expect(broken.action).toBe("BUY")
    expect(broken.quantity).toBe(7)
  })

  it("seeds EMA from the first window", () => {
    expect(emaFromCloses([1, 2, 3, 4], 3)).not.toBeNull()
    expect(emaFromCloses([1, 2], 3)).toBeNull()
  })
})
