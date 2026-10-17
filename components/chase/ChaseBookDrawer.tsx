import { Button, Drawer, MenuItem, Stack, TextField, Typography } from "@mui/material"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"

import { CHASE_OPEN_CLASSIFY, type ChaseBookConfig } from "../../lib/chaseDefaults"
import { normalizeChaseOpenClassify } from "../../lib/chaseOpenClassify"
import FieldRow from "../forms/FieldRow"
import ChaseSparkChart from "./ChaseSparkChart"

const NOTES: Record<string, string> = {
  lots: "How many futures lots this book trades.",
  emaPeriod: "Hourly EMA length on typical price.",
  bufferPercent: "Close must clear the EMA by this percent.",
  marketProtectionPercent: "Limit distance from last price on market orders (0.25–5).",
  entryLimitOffset: "Rupees added/subtracted from trigger for the entry limit.",
  openClassify: "PDF uses 09:16 candle close; Legacy steps 60-minute EMA.",
}

export default function ChaseBookDrawer({
  open,
  book,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  book: ChaseBookConfig | null
  onClose: () => void
  onSave: (patch: Partial<ChaseBookConfig>) => Promise<void>
  saving?: boolean
}) {
  const { control, handleSubmit, reset } = useForm<ChaseBookConfig>({
    defaultValues: book ?? undefined,
  })

  useEffect(() => {
    if (book) reset(book)
  }, [book, reset])

  if (!book) return null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 400 }, p: 2 } } }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        Edit {book.instrument}
      </Typography>
      <ChaseSparkChart instrument={book.instrument} />
      <Stack
        spacing={0}
        component="form"
        onSubmit={handleSubmit(values => onSave(values))}
        sx={{ mt: 2 }}
      >
        <Controller
          name="lots"
          control={control}
          render={({ field }) => (
            <FieldRow label="Lots" helper={NOTES.lots}>
              <TextField {...field} type="number" size="small" fullWidth />
            </FieldRow>
          )}
        />
        <Controller
          name="emaPeriod"
          control={control}
          render={({ field }) => (
            <FieldRow label="EMA" helper={NOTES.emaPeriod}>
              <TextField {...field} type="number" size="small" fullWidth />
            </FieldRow>
          )}
        />
        <Controller
          name="bufferPercent"
          control={control}
          render={({ field }) => (
            <FieldRow label="Buffer %" helper={NOTES.bufferPercent}>
              <TextField {...field} type="number" size="small" fullWidth />
            </FieldRow>
          )}
        />
        <Controller
          name="marketProtectionPercent"
          control={control}
          render={({ field }) => (
            <FieldRow label="Protect %" helper={NOTES.marketProtectionPercent}>
              <TextField {...field} type="number" size="small" fullWidth />
            </FieldRow>
          )}
        />
        <Controller
          name="entryLimitOffset"
          control={control}
          render={({ field }) => (
            <FieldRow label="Entry offset (₹)" helper={NOTES.entryLimitOffset}>
              <TextField {...field} type="number" size="small" fullWidth />
            </FieldRow>
          )}
        />
        <Controller
          name="openClassify"
          control={control}
          render={({ field }) => (
            <FieldRow label="09:16 classify" helper={NOTES.openClassify}>
              <TextField
                {...field}
                select
                size="small"
                fullWidth
                onChange={e => field.onChange(normalizeChaseOpenClassify(e.target.value))}
              >
                <MenuItem value={CHASE_OPEN_CLASSIFY.PDF_0916}>PDF 09:16</MenuItem>
                <MenuItem value={CHASE_OPEN_CLASSIFY.LEGACY_60M}>Legacy 60m</MenuItem>
              </TextField>
            </FieldRow>
          )}
        />
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  )
}
