import type { StrategySignal } from "../trading/signals"

function num(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : null
}

export function signalExplain(
  row: Pick<StrategySignal, "kind" | "outcome" | "summary" | "features">
): string {
  const f = row.features || {}
  if (row.kind === "EMA_COMPARE") {
    const close = num(f.close)
    const ema = num(f.ema)
    const buffer = num(f.bufferPts ?? f.buffer)
    const side = f.side ? String(f.side) : null
    const parts: string[] = []
    if (close && ema) parts.push(`Close ${close} vs EMA ${ema}`)
    if (buffer) parts.push(`buffer ${buffer} pts`)
    if (side) parts.push(`bias ${side}`)
    if (parts.length) return parts.join(" · ")
  }
  if (row.kind === "SKEW_SAMPLE") {
    const skew = num(f.skew ?? f.skewPct)
    if (skew) return `Skew sample ${skew}`
  }
  if (row.kind === "STRIKE_SELECT") {
    const ce = f.ceStrike ?? f.ce
    const pe = f.peStrike ?? f.pe
    if (ce || pe) return `Strikes CE ${ce ?? "—"} / PE ${pe ?? "—"}`
  }
  if (row.outcome === "WAIT" || row.outcome === "HOLD") {
    return row.summary || "Waiting for the next evaluation window."
  }
  if (row.outcome === "REJECT") {
    return row.summary || "Evaluation rejected — see alerts or decisions."
  }
  return row.summary
}
