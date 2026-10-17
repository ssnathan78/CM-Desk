import type { StrategySignal } from "../trading/signals"

export function signalGroupKey(row: StrategySignal): string {
  return [
    row.strategy ?? "",
    row.instrument ?? row.tradingsymbol ?? "",
    row.kind,
    row.outcome,
    row.summary,
  ].join("\0")
}

export type SignalRowView =
  | { mode: "single"; row: StrategySignal }
  | {
      mode: "group"
      key: string
      count: number
      first: StrategySignal
      last: StrategySignal
      rows: StrategySignal[]
    }

export function groupConsecutiveSignals(rows: StrategySignal[]): SignalRowView[] {
  const out: SignalRowView[] = []
  let i = 0
  while (i < rows.length) {
    const row = rows[i]
    const key = signalGroupKey(row)
    let j = i + 1
    while (j < rows.length && signalGroupKey(rows[j]) === key) j++
    const run = rows.slice(i, j)
    if (run.length === 1) {
      out.push({ mode: "single", row: run[0] })
    } else {
      out.push({
        mode: "group",
        key: `${row.id}:${i}`,
        count: run.length,
        first: run[0],
        last: run[run.length - 1],
        rows: run,
      })
    }
    i = j
  }
  return out
}
