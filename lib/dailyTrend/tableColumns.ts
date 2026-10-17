import type { ColumnDef } from "../ui/columnVisibility"

export type DailyTrendTableColumnId =
  | "status"
  | "close"
  | "ema"
  | "signal"
  | "stop"
  | "name"
  | "industry"
  | "marketCapCr"
  | "budgetInr"
  | "emaPeriod"
  | "bufferPercent"
  | "exitBufferPercent"
  | "entryStyle"

export const DAILY_TREND_TABLE_COLUMNS: ColumnDef<DailyTrendTableColumnId>[] = [
  { id: "status", label: "State" },
  { id: "close", label: "Close" },
  { id: "ema", label: "EMA" },
  { id: "signal", label: "Signal" },
  { id: "stop", label: "Stop" },
  { id: "name", label: "Name", defaultVisible: false },
  { id: "industry", label: "Industry", defaultVisible: false },
  { id: "marketCapCr", label: "Mcap ₹ cr", defaultVisible: false },
  { id: "budgetInr", label: "Budget" },
  { id: "emaPeriod", label: "EMA period" },
  { id: "bufferPercent", label: "Buffer" },
  { id: "exitBufferPercent", label: "Exit" },
  { id: "entryStyle", label: "Entry" },
]

export const DAILY_TREND_VISIBLE_COLUMNS_KEY = "dailyTrend.bookTable.visibleColumns"

export const DAILY_TREND_COLUMN_ORDER: DailyTrendTableColumnId[] = DAILY_TREND_TABLE_COLUMNS.map(
  c => c.id
)

export function dailyTrendColumnsInOrder(
  visible: DailyTrendTableColumnId[]
): DailyTrendTableColumnId[] {
  const allowed = new Set(DAILY_TREND_COLUMN_ORDER)
  return visible.filter(id => allowed.has(id))
}
