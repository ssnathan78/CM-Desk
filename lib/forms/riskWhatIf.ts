import { notionalVsCap } from "../trading/notional"
import type { DeskSetupNotional, SetupNotionalRow } from "../trading/setupNotional"

export function previewSetupNotional(
  setups: DeskSetupNotional | undefined,
  draftMaxNotionalInr: number
): SetupNotionalRow[] {
  if (!setups?.rows?.length) return []
  return setups.rows.map(row => {
    const notional = row.notional
    const overCap =
      notional != null && Number.isFinite(notional)
        ? notionalVsCap(notional, draftMaxNotionalInr).overCap
        : row.overCap
    return {
      ...row,
      maxNotionalInr: draftMaxNotionalInr,
      overCap,
    }
  })
}

export function notionalPreviewDelta(
  saved: DeskSetupNotional | undefined,
  draftMaxNotionalInr: number
): { label: string; wasOver: boolean; nowOver: boolean }[] {
  if (!saved?.rows?.length) return []
  const savedCap = saved.maxNotionalInr
  const draftRows = previewSetupNotional(saved, draftMaxNotionalInr)
  return draftRows
    .map((row, i) => {
      const wasOver = saved.rows[i]?.overCap ?? false
      return {
        label: row.label,
        wasOver,
        nowOver: row.overCap,
      }
    })
    .filter(r => r.wasOver !== r.nowOver || r.nowOver)
}
