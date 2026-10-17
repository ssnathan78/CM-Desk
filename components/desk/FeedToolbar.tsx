import { Button, Stack } from "@mui/material"
import type { ReactNode } from "react"

import type { FeedPeriod } from "../../lib/trading/feedWindow"
import type { HistoryPreset } from "../../lib/trading/historyRange"
import HistoryPeriod from "./HistoryPeriod"

export default function FeedToolbar({
  preset,
  from,
  to,
  onPreset,
  onFrom,
  onTo,
  onClear,
  extra,
}: {
  preset: HistoryPreset
  from: string
  to: string
  onPreset: (preset: HistoryPreset) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onClear: (period: FeedPeriod) => void
  extra?: ReactNode
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1}
      sx={{ px: 2, pt: 1.5, mb: 1.5, flexWrap: "wrap", alignItems: { md: "center" } }}
    >
      <HistoryPeriod
        preset={preset}
        from={from}
        to={to}
        onPreset={onPreset}
        onFrom={onFrom}
        onTo={onTo}
      />
      {extra}
    </Stack>
  )
}
