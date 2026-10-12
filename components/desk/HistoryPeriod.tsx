import { FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material"

import type { HistoryPreset } from "../../lib/trading/historyRange"

const fieldSx = {
  minWidth: { xs: "100%", sm: 160 },
  width: { xs: "100%", sm: "auto" },
}

export default function HistoryPeriod({
  preset,
  from,
  to,
  onPreset,
  onFrom,
  onTo,
}: {
  preset: HistoryPreset
  from: string
  to: string
  onPreset: (preset: HistoryPreset) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
}) {
  return (
    <>
      <FormControl size="small" sx={fieldSx}>
        <InputLabel>Period</InputLabel>
        <Select
          label="Period"
          value={preset}
          onChange={e => onPreset(e.target.value as HistoryPreset)}
        >
          <MenuItem value="today">Today (IST)</MenuItem>
          <MenuItem value="all">All time</MenuItem>
          <MenuItem value="month">This month</MenuItem>
          <MenuItem value="quarter">This quarter</MenuItem>
          <MenuItem value="year">This year</MenuItem>
          <MenuItem value="custom">Custom</MenuItem>
        </Select>
      </FormControl>
      {preset === "custom" ? (
        <>
          <TextField
            size="small"
            type="date"
            label="From"
            slotProps={{ inputLabel: { shrink: true } }}
            value={from}
            onChange={e => onFrom(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            slotProps={{ inputLabel: { shrink: true } }}
            value={to}
            onChange={e => onTo(e.target.value)}
            sx={fieldSx}
          />
        </>
      ) : null}
    </>
  )
}
