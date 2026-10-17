import type { ColumnDef } from "../ui/columnVisibility"

export type ChaseTableColumnId =
  | "emaPeriod"
  | "bufferPercent"
  | "marketProtectionPercent"
  | "entryLimitOffset"
  | "openClassify"
  | "state"
  | "mode"
  | "qty"
  | "avg"
  | "mark"
  | "openMark"
  | "contract"
  | "engine"
  | "pause"
  | "lots"

export const CHASE_BOOK_COLUMNS: ColumnDef<ChaseTableColumnId>[] = [
  { id: "emaPeriod", label: "EMA" },
  { id: "bufferPercent", label: "Buffer %" },
  { id: "marketProtectionPercent", label: "Protect %" },
  { id: "entryLimitOffset", label: "Offset (₹)" },
  { id: "openClassify", label: "Open" },
  { id: "state", label: "State" },
  { id: "mode", label: "Mode" },
  { id: "qty", label: "Qty" },
  { id: "avg", label: "Avg (₹)" },
  { id: "mark", label: "Mark (₹)" },
  { id: "openMark", label: "Unrealised P&L (₹)" },
  { id: "contract", label: "Contract" },
  { id: "engine", label: "Engine" },
  { id: "pause", label: "New entries" },
  { id: "lots", label: "Lots" },
]

export const CHASE_VISIBLE_COLUMNS_KEY = "chase.books.visibleColumns"

export const CHASE_COLUMN_ORDER: ChaseTableColumnId[] = CHASE_BOOK_COLUMNS.map(c => c.id)

/** Visible columns in the operator’s saved order (unknown ids dropped). */
export function chaseColumnsInOrder(visible: ChaseTableColumnId[]): ChaseTableColumnId[] {
  const allowed = new Set(CHASE_COLUMN_ORDER)
  return visible.filter(id => allowed.has(id))
}
