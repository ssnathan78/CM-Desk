import { readFileSync } from "fs"
import { resolve } from "path"

describe("schema guardrails", () => {
  it("enforces one trade plan per weekday, strategy, and index", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/0001_plan_uniqueness_and_defaults.sql"),
      "utf8"
    )
    expect(sql).toContain("trade_plans_day_strategy_uidx")
    const later = readFileSync(
      resolve(__dirname, "../../drizzle/0015_trade_plans_day_strategy_instrument.sql"),
      "utf8"
    )
    expect(later).toContain("trade_plans_day_strategy_instrument_uidx")
    expect(sql).toContain("strategy_defaults")
  })

  it("stores one Chase settings row per index", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/0014_chase_settings_per_instrument.sql"),
      "utf8"
    )
    expect(sql).toContain("chase_settings_book")
    expect(sql).toContain("instrument")
    expect(sql).toContain("enabled")
  })

  it("persists Chase 09:16 classifier with PDF as the default", () => {
    const sql = readFileSync(resolve(__dirname, "../../drizzle/0013_chase_open_classify.sql"), "utf8")
    expect(sql).toContain("open_classify")
    expect(sql).toContain("pdf_0916")
    expect(sql).toContain("legacy_60m")
  })

  it("adds Midcap Nifty (MIDCPNIFTY) as a Chase book, off by default", () => {
    const sql = readFileSync(resolve(__dirname, "../../drizzle/0016_chase_midcpnifty.sql"), "utf8")
    expect(sql).toContain("MIDCPNIFTY")
    expect(sql).toContain("false")
  })

  it("adds extras jsonb for strangle entry fields", () => {
    const sql = readFileSync(resolve(__dirname, "../../drizzle/0003_plan_extras.sql"), "utf8")
    expect(sql).toContain("extras jsonb")
  })

  it("keeps the dual P&L ADR in tree", () => {
    const adr = readFileSync(resolve(__dirname, "../../docs/adr/0002-dual-pnl-metrics.md"), "utf8")
    expect(adr.toLowerCase()).toMatch(/points/)
    expect(adr.toLowerCase()).toMatch(/rupee/)
  })
})
