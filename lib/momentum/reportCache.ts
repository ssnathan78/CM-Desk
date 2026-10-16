import { createHash } from "node:crypto"

/** Preview, send, deploy, and trim always rebuild. A plain page load may use the stored rank. */
export function shouldUseStoredMomentumReport(options?: {
  fresh?: boolean
  deployCash?: boolean
  trimPct?: number
}): boolean {
  return !(options?.fresh || options?.deployCash || (options?.trimPct ?? 0) > 0)
}

import type { WeightLock } from "./engine"
import type { MomentumConfig } from "./types"

export function momentumReportFingerprint(input: {
  config: MomentumConfig
  locks: WeightLock[]
  holdings: { symbol: string; quantity: number }[]
  universe: string[]
  asOf: string
}): string {
  const body = JSON.stringify({
    config: input.config,
    locks: input.locks
      .map(lock => ({ symbol: lock.symbol, mode: lock.mode, weightPct: lock.weightPct }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    holdings: input.holdings
      .map(row => ({ symbol: row.symbol, quantity: row.quantity }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    universe: [...input.universe].sort(),
    asOf: input.asOf,
  })
  return createHash("sha256").update(body).digest("hex")
}
