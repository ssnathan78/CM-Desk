import {
  Box,
  Button,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material"

export type DailyTrendRuntimeConfig = {
  active: boolean
  dataRefresh: boolean
  execution: "report" | "manual" | "auto"
  limitBufferPercent: number
}

export default function DailyTrendEngineToolbar({
  runtime,
  busy,
  pull,
  onPatch,
  onSave,
  onPullHistory,
  onPullMissing,
  onEvaluate,
  onEvaluateSend,
}: {
  runtime: DailyTrendRuntimeConfig
  busy: boolean
  pull: {
    running: boolean
    done: number
    total: number
    message: string | null
    shown: boolean
  } | null
  onPatch: (patch: Partial<DailyTrendRuntimeConfig>) => void
  onSave: () => void
  onPullHistory: () => void
  onPullMissing: () => void
  onEvaluate: () => void
  onEvaluateSend: () => void
}) {
  return (
    <>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1 }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={runtime.active}
              onChange={e => onPatch({ active: e.target.checked })}
              slotProps={{ input: { "aria-label": "Engine on" } }}
            />
          }
          label="Engine"
        />
        <FormControlLabel
          control={
            <Switch
              checked={runtime.dataRefresh}
              onChange={e => onPatch({ dataRefresh: e.target.checked })}
              slotProps={{ input: { "aria-label": "Pull data daily" } }}
            />
          }
          label="Pull daily"
        />
        <TextField
          select
          size="small"
          label="Execution"
          value={runtime.execution}
          onChange={e =>
            onPatch({ execution: e.target.value as DailyTrendRuntimeConfig["execution"] })
          }
          sx={{ minWidth: { xs: "100%", sm: 168 } }}
        >
          <MenuItem value="report">Report only</MenuItem>
          <MenuItem value="manual">Manual send</MenuItem>
          <MenuItem value="auto">Auto</MenuItem>
        </TextField>
        <Button variant="contained" disabled={busy} onClick={onSave}>
          Save
        </Button>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", mt: 1.5, rowGap: 1 }}
      >
        <Button disabled={busy || pull?.running} onClick={onPullHistory}>
          {pull?.running ? `Pulling ${pull.done} of ${pull.total || "…"}` : "Pull history now"}
        </Button>
        <Button disabled={busy || pull?.running} onClick={onPullMissing}>
          Retry missing
        </Button>
        <Button disabled={busy} onClick={onEvaluate}>
          Evaluate
        </Button>
        <Button
          color="warning"
          disabled={busy || runtime.execution === "report"}
          onClick={onEvaluateSend}
        >
          Evaluate and send
        </Button>
      </Stack>
      {pull && (pull.running || pull.shown) ? (
        <Box sx={{ mt: 1.5 }}>
          {pull.running ? (
            <LinearProgress
              variant={pull.total > 0 ? "determinate" : "indeterminate"}
              value={pull.total > 0 ? Math.round((100 * pull.done) / pull.total) : 0}
            />
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {pull.message}
          </Typography>
        </Box>
      ) : null}
    </>
  )
}
