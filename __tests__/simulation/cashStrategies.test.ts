import { simulate } from "../../lib/simulation/runner"
import { simFailed } from "../../lib/simulation/report"

const NAMES = [
  "momentum-report-no-orders",
  "momentum-risk-reject-no-fill",
  "momentum-halt-allows-exit",
  "momentum-disabled-no-exit",
  "daily-trend-reject-no-phantom",
  "daily-trend-flat-stop-does-not-open",
  "daily-trend-halt-allows-exit",
  "daily-trend-disabled-no-exit",
  "daily-trend-paper-blocked-by-live",
] as const

describe("cash strategy adversarial scenarios", () => {
  it.each(NAMES)("%s", name => {
    const result = simulate({ scenario: name, seed: 1 })
    if (simFailed(result)) {
      const detail = [
        ...result.invariantViolations,
        ...result.assertionResults.filter(row => !row.ok).map(row => `${row.assertion.type}: ${row.message}`),
        ...result.errors,
      ].join("\n")
      throw new Error(detail)
    }
    const trend = (
      result.finalState.actorStatus as Array<{ strategy: string; trendStatus?: string }>
    ).find(row => row.strategy === "DAILY_TREND")
    if (name === "daily-trend-reject-no-phantom") {
      expect(trend?.trendStatus).not.toBe("LONG")
    }
    if (name === "momentum-disabled-no-exit" || name === "daily-trend-disabled-no-exit") {
      const paper = (result.finalState.paperQty as Record<string, number> | undefined)?.RELIANCE ?? 0
      expect(paper).toBeGreaterThan(0)
      expect(result.orders.filter(order => order.role !== "ENTRY" && order.status !== "REJECTED")).toHaveLength(0)
    }
  })
})
