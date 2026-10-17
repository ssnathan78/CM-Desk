export type RebalanceOrderLine = {
  symbol: string
  side: string
  quantity: number
}

export type RebalancePreviewDiff = {
  added: RebalanceOrderLine[]
  removed: RebalanceOrderLine[]
  changed: { symbol: string; side: string; fromQty: number; toQty: number }[]
  unchanged: number
  summary: string
}

function orderKey(row: RebalanceOrderLine) {
  return `${row.side}:${row.symbol}`
}

export function diffRebalancePreview(
  previous: RebalanceOrderLine[] | null | undefined,
  next: RebalanceOrderLine[]
): RebalancePreviewDiff {
  const prevMap = new Map((previous ?? []).map(row => [orderKey(row), row.quantity] as const))
  const nextMap = new Map(next.map(row => [orderKey(row), row.quantity] as const))

  const added: RebalanceOrderLine[] = []
  const removed: RebalanceOrderLine[] = []
  const changed: RebalancePreviewDiff["changed"] = []
  let unchanged = 0

  for (const row of next) {
    const key = orderKey(row)
    if (!prevMap.has(key)) {
      added.push(row)
      continue
    }
    const fromQty = prevMap.get(key)!
    if (fromQty === row.quantity) unchanged += 1
    else changed.push({ symbol: row.symbol, side: row.side, fromQty, toQty: row.quantity })
  }

  for (const row of previous ?? []) {
    const key = orderKey(row)
    if (!nextMap.has(key)) removed.push(row)
  }

  const parts: string[] = []
  if (added.length) parts.push(`${added.length} new`)
  if (removed.length) parts.push(`${removed.length} dropped`)
  if (changed.length) parts.push(`${changed.length} qty change`)
  if (!parts.length) parts.push(unchanged ? `${unchanged} same as last preview` : "empty preview")

  return {
    added,
    removed,
    changed,
    unchanged,
    summary: parts.join(", "),
  }
}
