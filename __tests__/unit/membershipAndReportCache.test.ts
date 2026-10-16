import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { DEFAULT_MOMENTUM_CONFIG } from "../../lib/momentum/types"
import {
  membershipStale,
  parseConstituentCsv,
  membershipFileApplies,
  planMembershipDiff,
  symbolsMissingFromSnapshot,
} from "../../lib/momentum/membership"
import {
  momentumReportFingerprint,
  shouldUseStoredMomentumReport,
} from "../../lib/momentum/reportCache"

const base = {
  config: DEFAULT_MOMENTUM_CONFIG,
  locks: [],
  holdings: [],
  universe: ["RELIANCE", "TCS"],
  asOf: "2026-10-15",
}

describe("momentum report cache", () => {
  it("keeps the same fingerprint when the inputs match", () => {
    expect(momentumReportFingerprint(base)).toBe(momentumReportFingerprint({ ...base }))
  })

  it("misses when holdings, locks, or the universe change", () => {
    const start = momentumReportFingerprint(base)
    expect(
      momentumReportFingerprint({ ...base, holdings: [{ symbol: "TCS", quantity: 10 }] })
    ).not.toBe(start)
    expect(
      momentumReportFingerprint({
        ...base,
        locks: [{ symbol: "TCS", mode: "EXCLUDE", weightPct: 0 }],
      })
    ).not.toBe(start)
    expect(momentumReportFingerprint({ ...base, universe: ["RELIANCE"] })).not.toBe(start)
    expect(momentumReportFingerprint({ ...base, asOf: "2026-10-16" })).not.toBe(start)
  })

  it("uses the stored rank only for a plain page load", () => {
    expect(shouldUseStoredMomentumReport()).toBe(true)
    expect(shouldUseStoredMomentumReport({ fresh: true })).toBe(false)
    expect(shouldUseStoredMomentumReport({ deployCash: true })).toBe(false)
    expect(shouldUseStoredMomentumReport({ trimPct: 10 })).toBe(false)
  })
})

describe("index membership diff", () => {
  const csv = [
    "Company Name,Industry,Symbol,Series,ISIN Code",
    "Reliance Industries Ltd.,Energy,RELIANCE,EQ,INE002A01018",
    "Tata Consultancy Services Ltd.,Information Technology,TCS,EQ,INE467B01029",
  ].join("\n")

  it("parses the bundled Nifty files", () => {
    const nifty100 = parseConstituentCsv(
      readFileSync(resolve(process.cwd(), "data/universe/nifty-100.csv"), "utf8")
    )
    const total = parseConstituentCsv(
      readFileSync(resolve(process.cwd(), "data/universe/nifty-total-market.csv"), "utf8")
    )
    expect(nifty100.length).toBeGreaterThan(90)
    expect(total.length).toBeGreaterThan(700)
    expect(total.some(row => row.symbol === "M&M")).toBe(true)
    expect(nifty100.some(row => row.symbol === "RELIANCE")).toBe(true)
  })

  it("parses the constituent file, including a comma in the company name", () => {
    const parsed = parseConstituentCsv(
      `${csv}\n"Larsen, Toubro",Construction,LT,EQ,INE018A01030`
    )
    expect(parsed.map(row => row.symbol)).toEqual(["RELIANCE", "TCS", "LT"])
    expect(parsed[2]?.name).toBe("Larsen, Toubro")
  })

  it("does not apply an empty file", () => {
    const plan = planMembershipDiff({
      indexCode: "NIFTY100",
      incoming: [],
      previous: ["RELIANCE"],
      universe: [],
      books: ["RELIANCE"],
      locks: [],
      openSymbols: ["RELIANCE"],
    })
    expect(plan.apply).toBe(false)
    expect(plan.pending).toEqual([])
  })

  it("adds a new Nifty 100 name as a book and leaves an existing book alone", () => {
    const plan = planMembershipDiff({
      indexCode: "NIFTY100",
      incoming: parseConstituentCsv(csv),
      previous: ["RELIANCE"],
      universe: [],
      books: ["RELIANCE"],
      locks: [],
      openSymbols: [],
    })
    expect(plan.apply).toBe(true)
    expect(plan.autoAddBooks.map(row => row.symbol)).toEqual(["TCS"])
    expect(plan.pending).toEqual([])
  })

  it("holds a total-market add until accept", () => {
    const plan = planMembershipDiff({
      indexCode: "NIFTY_TOTAL_MARKET",
      incoming: parseConstituentCsv(csv),
      previous: ["RELIANCE"],
      universe: ["RELIANCE"],
      books: [],
      locks: [],
      openSymbols: [],
    })
    expect(plan.autoAddBooks).toEqual([])
    expect(plan.pending).toEqual([
      expect.objectContaining({ symbol: "TCS", action: "ADD" }),
    ])
  })

  it("holds a removal and names an open quantity, a lock, and a daily-trend book", () => {
    const plan = planMembershipDiff({
      indexCode: "NIFTY_TOTAL_MARKET",
      incoming: parseConstituentCsv(csv).filter(row => row.symbol === "TCS"),
      previous: ["RELIANCE", "TCS"],
      universe: ["RELIANCE", "TCS"],
      books: ["RELIANCE"],
      locks: ["RELIANCE"],
      openSymbols: ["RELIANCE"],
    })
    const removal = plan.pending.find(row => row.symbol === "RELIANCE")
    expect(removal?.action).toBe("REMOVE")
    expect(removal?.note).toMatch(/does not sell now/)
    expect(removal?.note).toMatch(/open quantity/)
    expect(removal?.note).toMatch(/weight lock/)
    expect(removal?.note).toMatch(/daily-trend book/)
  })

  it("keeps a stored snapshot when the download falls back to the bundled file", () => {
    expect(membershipFileApplies("remote", 754)).toBe(true)
    expect(membershipFileApplies("bundled", 0)).toBe(true)
    expect(membershipFileApplies("bundled", 754)).toBe(false)
  })

  it("queues rank-list names missing from a file, and never from an empty file", () => {
    expect(symbolsMissingFromSnapshot(["AAA", "BBB"], ["AAA"], [])).toEqual(["BBB"])
    expect(symbolsMissingFromSnapshot(["BBB"], ["AAA"], ["BBB"])).toEqual([])
    expect(symbolsMissingFromSnapshot(["AAA", "BBB"], [], [])).toEqual([])
  })

  it("treats a missing snapshot as due and a six-day-old snapshot as current", () => {
    expect(membershipStale(null, "2026-10-16")).toBe(true)
    expect(membershipStale("2026-10-09", "2026-10-16")).toBe(true)
    expect(membershipStale("2026-10-10", "2026-10-16")).toBe(false)
  })
})
