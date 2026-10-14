import { type MomentumSymbol, symbolFromBars } from "./engine"
import { listMarketCaps, loadBars } from "./store"
import type { MomentumConfig } from "./types"

/** Rank inputs for a slice of names, then drop the candles before the next slice. */
export async function rankedSymbols(
  universe: { symbol: string }[],
  config: MomentumConfig,
  asOf: string
) {
  const caps = new Map((await listMarketCaps()).map(row => [row.symbol, row.marketCapCr]))
  const symbols: MomentumSymbol[] = []
  const batch = 20
  for (let i = 0; i < universe.length; i += batch) {
    const slice = universe.slice(i, i + batch)
    const bars = await loadBars(slice.map(row => row.symbol))
    for (const row of slice) {
      symbols.push(
        symbolFromBars(
          row.symbol,
          bars.get(row.symbol) ?? [],
          config,
          asOf,
          caps.get(row.symbol) ?? null
        )
      )
    }
    await new Promise(resolve => setImmediate(resolve))
  }
  return symbols
}
