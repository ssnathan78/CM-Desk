export type PendingChange = { action: "ADD" | "REMOVE"; symbol: string }

export function buildConstituentImpactPreview(
  pending: PendingChange[],
  trendBookSymbols: string[]
) {
  const bookSet = new Set(trendBookSymbols)
  const adds = pending.filter(p => p.action === "ADD").map(p => p.symbol)
  const removes = pending.filter(p => p.action === "REMOVE").map(p => p.symbol)
  const wouldAdd = adds.filter(s => !bookSet.has(s))
  const wouldRemove = removes.filter(s => bookSet.has(s))
  return {
    adds,
    removes,
    trend: {
      wouldAdd,
      wouldRemove,
      openBooksAffected: wouldRemove,
    },
  }
}
