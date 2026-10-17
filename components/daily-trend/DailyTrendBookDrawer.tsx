import { Button, Drawer, MenuItem, Stack, Typography } from "@mui/material"
import { useEffect, useState } from "react"

import { SettingsNumberField, SettingsSelectField } from "../forms/SettingsFields"

export type DailyTrendBookDraft = {
  symbol: string
  name?: string
  budgetInr: number
  emaPeriod: number
  bufferPercent: number
  exitBufferPercent: number
  entryStyle: "CLOSE_CROSS" | "BREAK_HIGH"
  enabled: boolean
  paused: boolean
  quantity: number
  status: string
  stop: number | null
  entry: number | null
}

type Props = {
  open: boolean
  book: DailyTrendBookDraft | null
  busy: boolean
  onClose: () => void
  onSave: (book: DailyTrendBookDraft) => Promise<void>
}

export default function DailyTrendBookDrawer({ open, book, busy, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<DailyTrendBookDraft | null>(book)

  useEffect(() => {
    setDraft(book)
  }, [book])

  if (!draft) return null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 400 }, p: 2 } } }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        {draft.symbol || "Symbol"}
      </Typography>
      <Stack spacing={0}>
        <SettingsNumberField
          label="Budget INR"
          helper="Shares bought = floor(budget / last completed close). 0 buys nothing."
          value={draft.budgetInr}
          onChange={budgetInr => setDraft({ ...draft, budgetInr })}
        />
        <SettingsNumberField
          label="EMA"
          value={draft.emaPeriod}
          onChange={emaPeriod => setDraft({ ...draft, emaPeriod })}
        />
        <SettingsNumberField
          label="Buffer %"
          value={draft.bufferPercent}
          onChange={bufferPercent => setDraft({ ...draft, bufferPercent })}
        />
        <SettingsNumberField
          label="Exit buffer %"
          value={draft.exitBufferPercent}
          onChange={exitBufferPercent => setDraft({ ...draft, exitBufferPercent })}
        />
        <SettingsSelectField
          label="Entry"
          value={draft.entryStyle}
          onChange={entryStyle => setDraft({ ...draft, entryStyle })}
        >
          <MenuItem value="CLOSE_CROSS">Buy the close cross</MenuItem>
          <MenuItem value="BREAK_HIGH">Wait for that day&apos;s high</MenuItem>
        </SettingsSelectField>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={busy || !draft.symbol}
          onClick={() => void onSave(draft)}
        >
          Save
        </Button>
      </Stack>
    </Drawer>
  )
}
