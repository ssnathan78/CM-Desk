import type { StrategySignal } from "../../lib/trading/signals"
import { groupConsecutiveSignals, signalGroupKey } from "../../lib/ui/signalGrouping"

function sig(partial: Partial<StrategySignal> & { id: string }): StrategySignal {
  return {
    id: partial.id,
    occurredAt: partial.occurredAt ?? "2026-01-01T10:00:00.000Z",
    strategy: partial.strategy ?? "CHASE",
    instrument: partial.instrument ?? "NIFTY",
    tradingsymbol: partial.tradingsymbol ?? null,
    kind: partial.kind ?? "EMA",
    outcome: partial.outcome ?? "WAIT",
    summary: partial.summary ?? "same",
    planRef: partial.planRef ?? null,
    orderTag: partial.orderTag ?? null,
    jobName: partial.jobName ?? null,
    jobId: partial.jobId ?? null,
    features: partial.features ?? {},
  }
}

describe("signalGrouping", () => {
  it("groups consecutive identical evaluations", () => {
    const rows = [
      sig({ id: "1", summary: "a" }),
      sig({ id: "2", summary: "a" }),
      sig({ id: "3", summary: "b" }),
    ]
    const views = groupConsecutiveSignals(rows)
    expect(views).toHaveLength(2)
    expect(views[0]).toMatchObject({ mode: "group", count: 2 })
    expect(views[1]).toMatchObject({ mode: "single", row: { id: "3" } })
  })

  it("does not group when summary differs", () => {
    const keyA = signalGroupKey(sig({ id: "1", summary: "x" }))
    const keyB = signalGroupKey(sig({ id: "2", summary: "y" }))
    expect(keyA).not.toBe(keyB)
  })
})
