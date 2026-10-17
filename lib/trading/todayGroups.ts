import { type Money, moneyAdd, moneyFromUnknown, moneyToString, moneyZero } from "./money"

export const TODAY_GROUPS = [
  { id: "intraday", label: "Intraday", strategies: ["ATM_STRADDLE", "ATM_STRANGLE"] },
  { id: "chase", label: "Chase", strategies: ["CHASE"] },
  { id: "daily", label: "Daily trend", strategies: ["DAILY_TREND"] },
  { id: "momentum", label: "Momentum", strategies: ["MOMENTUM"] },
] as const

export type TodayGroupRow = {
  id: string
  label: string
  open: number
  closedToday: string
  openMark: string
}

export function groupTodayBooks(input: {
  closed: { strategy: string | null; netPnl: string | null }[]
  open: { strategy: string | null; unrealized: string | null }[]
}): TodayGroupRow[] {
  const known = new Set<string>(TODAY_GROUPS.flatMap(group => group.strategies))
  const rows: TodayGroupRow[] = TODAY_GROUPS.map(group => {
    const strategies = new Set<string>(group.strategies)
    return {
      id: group.id,
      label: group.label,
      open: input.open.filter(row => strategies.has(row.strategy || "")).length,
      closedToday: moneyToString(sum(input.closed, strategies, row => row.netPnl)),
      openMark: moneyToString(sum(input.open, strategies, row => row.unrealized)),
    }
  })
  const otherClosed = input.closed.filter(row => !known.has(row.strategy || ""))
  const otherOpen = input.open.filter(row => !known.has(row.strategy || ""))
  if (otherClosed.length || otherOpen.length) {
    rows.push({
      id: "other",
      label: "Other",
      open: otherOpen.length,
      closedToday: moneyToString(sum(otherClosed, null, row => row.netPnl)),
      openMark: moneyToString(sum(otherOpen, null, row => row.unrealized)),
    })
  }
  return rows
}

export type StrategyRealizedRow = {
  id: string
  label: string
  realized: string
}

/** Lifetime realized already stored on position rows, grouped like the Today tile. */
export function groupStrategyRealized(
  rows: { strategy: string | null; realized: string | null }[]
): StrategyRealizedRow[] {
  const known = new Set<string>(TODAY_GROUPS.flatMap(group => group.strategies))
  const grouped: StrategyRealizedRow[] = TODAY_GROUPS.map(group => {
    const strategies = new Set<string>(group.strategies)
    return {
      id: group.id,
      label: group.label,
      realized: moneyToString(sum(rows, strategies, row => row.realized)),
    }
  })
  const other = rows.filter(row => !known.has(row.strategy || ""))
  if (other.length) {
    grouped.push({
      id: "other",
      label: "Other",
      realized: moneyToString(sum(other, null, row => row.realized)),
    })
  }
  return grouped
}

function sum<T extends { strategy: string | null }>(
  rows: T[],
  strategies: Set<string> | null,
  value: (row: T) => string | null
): Money {
  return rows.reduce((total, row) => {
    if (strategies && !strategies.has(row.strategy || "")) return total
    return moneyAdd(total, moneyFromUnknown(value(row)))
  }, moneyZero())
}
