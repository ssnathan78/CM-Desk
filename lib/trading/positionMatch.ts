/** Which existing position row a fill may update. */

export type PositionStrategyRow = { strategy: string | null | undefined }

export type PositionFillMatch<T> =
  | { action: "use"; row: T }
  | { action: "insert" }
  | { action: "refuse"; reason: string }

function strategyKey(strategy: string | null | undefined): string {
  return (strategy ?? "").trim()
}

/**
 * Same contract and job. A named strategy never updates a different named strategy.
 * A fill with no strategy updates the only existing row instead of opening a second book.
 * A named fill still claims a single untagged row (books opened before strategy was stored).
 */
export function matchPositionForFill<T extends PositionStrategyRow>(
  rows: T[],
  fillStrategy: string | null | undefined
): PositionFillMatch<T> {
  const fillKey = strategyKey(fillStrategy)
  const exact = rows.filter(row => strategyKey(row.strategy) === fillKey)
  if (exact.length > 0) return { action: "use", row: exact[0] }

  if (fillKey !== "") {
    const untagged = rows.filter(row => strategyKey(row.strategy) === "")
    if (untagged.length === 1) return { action: "use", row: untagged[0] }
    return { action: "insert" }
  }

  const tagged = rows.filter(row => strategyKey(row.strategy) !== "")
  if (tagged.length === 1) return { action: "use", row: tagged[0] }
  if (tagged.length > 1) {
    return {
      action: "refuse",
      reason: "fill has no strategy and more than one strategy already holds this contract",
    }
  }
  return { action: "insert" }
}

/** Broker snapshots often have only the order tag. Chase must still land on the Chase book. */
export function strategyForOrder(input: {
  strategy?: string | null
  orderTag?: string | null
}): string | null {
  if (input.strategy) return input.strategy
  if ((input.orderTag || "").toLowerCase() === "chase") return "CHASE"
  return null
}
