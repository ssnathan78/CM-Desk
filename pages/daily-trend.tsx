import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useState } from "react"
import useSWR from "swr"

import Layout from "../components/Layout"
import ScrollTable from "../components/lib/ScrollTable"
import { useSnackbar } from "../components/lib/useSnackbar"
import fetchJson from "../lib/fetchJson"
import useUser from "../lib/useUser"

type Book = {
  symbol: string
  enabled: boolean
  paused: boolean
  emaPeriod: number
  bufferPercent: number
  exitBufferPercent: number
  quantity: number
  entryStyle: "CLOSE_CROSS" | "BREAK_HIGH"
  status: string
  stop: number | null
  entry: number | null
}

type Payload = {
  config: {
    active: boolean
    dataRefresh: boolean
    execution: "report" | "manual" | "auto"
    limitBufferPercent: number
  }
  books: Book[]
  decisions?: { symbol: string; action: string; reason: string; state?: string }[]
}

const EMPTY: Book = {
  symbol: "",
  enabled: false,
  paused: false,
  emaPeriod: 40,
  bufferPercent: 0.2,
  exitBufferPercent: 0.2,
  quantity: 1,
  entryStyle: "CLOSE_CROSS",
  status: "FLAT",
  stop: null,
  entry: null,
}

export default function DailyTrendPage() {
  useUser({ redirectTo: "/" })
  const { showMessage, SnackbarAlert } = useSnackbar()
  const { data, mutate } = useSWR<Payload>("/api/daily-trend")
  const [config, setConfig] = useState<Payload["config"] | null>(null)
  const [draft, setDraft] = useState<Book>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [decisions, setDecisions] = useState<Payload["decisions"]>([])
  const runtime = config ??
    data?.config ?? {
      active: false,
      dataRefresh: false,
      execution: "report" as const,
      limitBufferPercent: 0.15,
    }

  async function saveRuntime(next = runtime) {
    setBusy(true)
    try {
      await fetchJson("/api/daily-trend", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: next }),
      })
      setConfig(null)
      await mutate()
      showMessage("Daily trend settings saved", "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function saveBook(book: Book) {
    setBusy(true)
    try {
      await fetchJson("/api/daily-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-book", ...book }),
      })
      setDraft(EMPTY)
      await mutate()
      showMessage(`${book.symbol} saved`, "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Daily trend">
      {SnackbarAlert}
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Daily long-only trend</Typography>
          <Typography variant="body2" color="text.secondary">
            Same idea as the Chase long side, on the cash symbol and on daily candles. There is no
            short. A buy is sent only after the close is above the EMA plus the buffer. The stop is
            the lower of the EMA and that day&apos;s low, and a later close through it sells the
            open quantity. A flat book does not sell. Report mode never sends that order. Each
            symbol has its own on/off switch. Desk → Risk → Daily trend has to be enabled before an
            order is accepted.
          </Typography>
        </Box>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="body2">On</Typography>
            <Switch
              checked={runtime.active}
              onChange={e => setConfig({ ...runtime, active: e.target.checked })}
            />
            <Typography variant="body2">Pull data</Typography>
            <Switch
              checked={runtime.dataRefresh}
              onChange={e => setConfig({ ...runtime, dataRefresh: e.target.checked })}
            />
            <TextField
              select
              size="small"
              label="Execution"
              value={runtime.execution}
              onChange={e =>
                setConfig({
                  ...runtime,
                  execution: e.target.value as Payload["config"]["execution"],
                })
              }
            >
              <MenuItem value="report">Report only</MenuItem>
              <MenuItem value="manual">Manual send</MenuItem>
              <MenuItem value="auto">Auto</MenuItem>
            </TextField>
            <Button variant="contained" disabled={busy} onClick={() => void saveRuntime()}>
              Save
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void fetchJson("/api/daily-trend", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "pull" }),
                })
                  .then(() => showMessage("History pull finished", "success"))
                  .catch(error =>
                    showMessage(error instanceof Error ? error.message : "Pull failed", "error")
                  )
              }
            >
              Pull history
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void fetchJson<Payload>("/api/daily-trend", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "evaluate", execute: false }),
                }).then(result => {
                  setDecisions(result.decisions ?? [])
                  showMessage(
                    "Evaluation finished. No orders were required in report mode.",
                    "success"
                  )
                })
              }
            >
              Evaluate
            </Button>
            <Button
              color="warning"
              disabled={busy || runtime.execution === "report"}
              onClick={() => {
                if (!window.confirm("Send the daily-trend orders this evaluation wants?")) return
                void fetchJson<Payload>("/api/daily-trend", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "evaluate", execute: true }),
                }).then(async result => {
                  setDecisions(result.decisions ?? [])
                  await mutate()
                  showMessage("Evaluate-and-send finished", "success")
                })
              }}
            >
              Evaluate and send
            </Button>
          </Stack>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add or edit a symbol
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <TextField
              size="small"
              label="Symbol"
              helperText="NSE cash only. M&M is valid. 123 and ABC are not."
              value={draft.symbol}
              onChange={e => setDraft({ ...draft, symbol: e.target.value.toUpperCase() })}
            />
            <TextField
              size="small"
              label="EMA"
              type="number"
              value={draft.emaPeriod}
              onChange={e => setDraft({ ...draft, emaPeriod: Number(e.target.value) })}
            />
            <TextField
              size="small"
              label="Buffer %"
              type="number"
              value={draft.bufferPercent}
              onChange={e => setDraft({ ...draft, bufferPercent: Number(e.target.value) })}
            />
            <TextField
              size="small"
              label="Exit buffer %"
              type="number"
              value={draft.exitBufferPercent}
              onChange={e => setDraft({ ...draft, exitBufferPercent: Number(e.target.value) })}
            />
            <TextField
              size="small"
              label="Shares"
              type="number"
              value={draft.quantity}
              onChange={e => setDraft({ ...draft, quantity: Number(e.target.value) })}
            />
            <TextField
              select
              size="small"
              label="Entry"
              value={draft.entryStyle}
              onChange={e =>
                setDraft({ ...draft, entryStyle: e.target.value as Book["entryStyle"] })
              }
            >
              <MenuItem value="CLOSE_CROSS">Buy the close cross</MenuItem>
              <MenuItem value="BREAK_HIGH">Wait for that day&apos;s high</MenuItem>
            </TextField>
            <Button disabled={busy || !draft.symbol} onClick={() => void saveBook(draft)}>
              Save symbol
            </Button>
          </Stack>
        </Paper>
        <ScrollTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>On</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>EMA</TableCell>
                <TableCell>Buffer</TableCell>
                <TableCell>Shares</TableCell>
                <TableCell>Entry</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Stop</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.books ?? []).map(book => (
                <TableRow key={book.symbol}>
                  <TableCell>
                    <Switch
                      checked={book.enabled}
                      onChange={e => void saveBook({ ...book, enabled: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>{book.symbol}</TableCell>
                  <TableCell>{book.emaPeriod}</TableCell>
                  <TableCell>{book.bufferPercent}</TableCell>
                  <TableCell>{book.quantity}</TableCell>
                  <TableCell>{book.entryStyle}</TableCell>
                  <TableCell>{book.paused ? "paused" : book.status}</TableCell>
                  <TableCell>{book.stop ?? "—"}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => setDraft(book)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      onClick={() => void saveBook({ ...book, paused: !book.paused })}
                    >
                      {book.paused ? "Resume" : "Pause"}
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        void fetchJson("/api/daily-trend", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "remove-book", symbol: book.symbol }),
                        }).then(() => mutate())
                      }
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
        {(decisions ?? []).length > 0 ? (
          <Paper sx={{ p: 2 }}>
            {decisions?.map(row => (
              <Typography key={row.symbol} variant="body2">
                {row.symbol}: {row.action} — {row.reason}
              </Typography>
            ))}
          </Paper>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          Spec: docs/strategies/DAILY_TREND.md
        </Typography>
      </Stack>
    </Layout>
  )
}
