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
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"
import useSWR from "swr"

import Layout from "../components/Layout"
import ScrollTable from "../components/lib/ScrollTable"
import { useSnackbar } from "../components/lib/useSnackbar"
import fetchJson from "../lib/fetchJson"
import useUser from "../lib/useUser"

type Book = {
  symbol: string
  name?: string
  industry?: string
  marketCapCr?: number | null
  marketCapAsOf?: string | null
  enabled: boolean
  paused: boolean
  emaPeriod: number
  bufferPercent: number
  exitBufferPercent: number
  quantity: number
  budgetInr: number
  entryStyle: "CLOSE_CROSS" | "BREAK_HIGH"
  status: string
  stop: number | null
  entry: number | null
}

type SortKey =
  | "enabled"
  | "symbol"
  | "name"
  | "industry"
  | "marketCapCr"
  | "budgetInr"
  | "emaPeriod"
  | "bufferPercent"
  | "exitBufferPercent"
  | "quantity"
  | "entryStyle"
  | "status"
  | "stop"

type Payload = {
  config: {
    active: boolean
    dataRefresh: boolean
    execution: "report" | "manual" | "auto"
    limitBufferPercent: number
  }
  marketCapAsOf?: string
  books: Book[]
  decisions?: { symbol: string; action: string; reason: string; state?: string }[]
}

const EMPTY: Book = {
  symbol: "",
  enabled: false,
  paused: false,
  emaPeriod: 40,
  bufferPercent: 1,
  exitBufferPercent: 1,
  quantity: 1,
  budgetInr: 0,
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
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("")
  const [matches, setMatches] = useState<{ symbol: string; name: string }[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("symbol")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [bulk, setBulk] = useState({
    emaPeriod: "",
    bufferPercent: "",
    exitBufferPercent: "",
    budgetInr: "",
    entryStyle: "",
  })
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
      setMatches(current => current.filter(row => row.symbol !== book.symbol))
      await mutate()
      showMessage(`${book.symbol} saved`, "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function applyToAll() {
    const body: Record<string, unknown> = { action: "apply-all" }
    if (bulk.emaPeriod !== "") body.emaPeriod = Number(bulk.emaPeriod)
    if (bulk.bufferPercent !== "") body.bufferPercent = Number(bulk.bufferPercent)
    if (bulk.exitBufferPercent !== "") body.exitBufferPercent = Number(bulk.exitBufferPercent)
    if (bulk.budgetInr !== "") body.budgetInr = Number(bulk.budgetInr)
    if (bulk.entryStyle !== "") body.entryStyle = bulk.entryStyle
    if (Object.keys(body).length === 1) {
      showMessage("Fill at least one field. Blank fields stay as they are.", "info")
      return
    }
    const count = data?.books.length ?? 0
    if (
      !window.confirm(
        `Apply these settings to all ${count} symbols? On/off, pause, status, and stops stay as they are.`
      )
    )
      return
    setBusy(true)
    try {
      const result = await fetchJson<{ count: number }>("/api/daily-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      setBulk({
        emaPeriod: "",
        bufferPercent: "",
        exitBufferPercent: "",
        budgetInr: "",
        entryStyle: "",
      })
      await mutate()
      showMessage(`Applied to ${result.count} symbols`, "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Apply failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function searchSymbols() {
    setBusy(true)
    try {
      const found = await fetchJson<{ matches: { symbol: string; name: string }[] }>(
        `/api/nse-cash-search?q=${encodeURIComponent(query)}`
      )
      setMatches(found.matches ?? [])
      if (!found.matches?.length) showMessage("No matching NSE cash symbol.", "info")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Search failed", "error")
    } finally {
      setBusy(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(current => (current === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir(key === "marketCapCr" || key === "enabled" ? "desc" : "asc")
    }
  }

  const books = useMemo(() => {
    const q = filter.trim().toUpperCase()
    const rows = (data?.books ?? []).filter(book => {
      if (!q) return true
      return (
        book.symbol.includes(q) ||
        (book.name || "").toUpperCase().includes(q) ||
        (book.industry || "").toUpperCase().includes(q)
      )
    })
    const dir = sortDir === "asc" ? 1 : -1
    const value = (book: Book): string | number => {
      if (sortKey === "enabled") return book.enabled ? 1 : 0
      if (sortKey === "status") return book.paused ? `paused ${book.status}` : book.status
      if (sortKey === "marketCapCr" || sortKey === "stop" || sortKey === "budgetInr")
        return book[sortKey] ?? Number.NEGATIVE_INFINITY
      if (sortKey === "name") return book.name || book.symbol
      if (sortKey === "industry") return book.industry || ""
      return book[sortKey]
    }
    return rows.slice().sort((a, b) => {
      const left = value(a)
      const right = value(b)
      if (typeof left === "number" && typeof right === "number") return (left - right) * dir
      return String(left).localeCompare(String(right)) * dir
    })
  }, [data?.books, filter, sortDir, sortKey])

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
            Add a symbol
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Search NSE cash"
              placeholder="RELIANCE, Mahindra, NIFTYBEES"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") void searchSymbols()
              }}
              sx={{ minWidth: { sm: 320 } }}
            />
            <Button variant="outlined" disabled={busy} onClick={() => void searchSymbols()}>
              Search
            </Button>
          </Stack>
          {matches.length ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              {matches.map(row => (
                <Button
                  key={row.symbol}
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => void saveBook({ ...EMPTY, symbol: row.symbol, name: row.name })}
                >
                  Add {row.symbol}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Apply to every symbol
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Fill only the fields you want to change. Blank fields stay as they are on each symbol.
            This does not turn a symbol on or off, and it does not change pause, status, or the
            stored stop.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              label="EMA"
              type="number"
              value={bulk.emaPeriod}
              onChange={e => setBulk({ ...bulk, emaPeriod: e.target.value })}
              sx={{ width: 90 }}
            />
            <TextField
              size="small"
              label="Buffer %"
              type="number"
              value={bulk.bufferPercent}
              onChange={e => setBulk({ ...bulk, bufferPercent: e.target.value })}
              sx={{ width: 110 }}
            />
            <TextField
              size="small"
              label="Exit %"
              type="number"
              value={bulk.exitBufferPercent}
              onChange={e => setBulk({ ...bulk, exitBufferPercent: e.target.value })}
              sx={{ width: 100 }}
            />
            <TextField
              size="small"
              label="Budget INR"
              type="number"
              value={bulk.budgetInr}
              onChange={e => setBulk({ ...bulk, budgetInr: e.target.value })}
              sx={{ width: 140 }}
            />
            <TextField
              select
              size="small"
              label="Entry"
              value={bulk.entryStyle}
              onChange={e => setBulk({ ...bulk, entryStyle: e.target.value })}
              sx={{ width: 160 }}
            >
              <MenuItem value="">Leave as is</MenuItem>
              <MenuItem value="CLOSE_CROSS">Close cross</MenuItem>
              <MenuItem value="BREAK_HIGH">Break high</MenuItem>
            </TextField>
            <Button variant="outlined" disabled={busy} onClick={() => void applyToAll()}>
              Apply to all
            </Button>
          </Stack>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Edit one symbol
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
              label="Budget INR"
              type="number"
              helperText="Shares bought = floor(budget / last completed close). 0 buys nothing."
              value={draft.budgetInr}
              onChange={e => setDraft({ ...draft, budgetInr: Number(e.target.value) })}
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
        <TextField
          size="small"
          label="Filter symbol, name, or industry"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          sx={{ maxWidth: 360 }}
        />
        <Typography variant="caption" color="text.secondary">
          Nifty 100 is loaded off. Market cap refreshes about 20 names an hour from Screener while
          this process is running, so the book turns over inside a day. The date next to the figure
          is when it was stored. The signal ignores today's candle and uses the last completed daily
          close. Buffer defaults are 1%. A buy size is floor(budget / that close). Turn a row on and
          set a budget before it can buy.
        </Typography>
        <ScrollTable minWidth={860}>
          <Table size="small" sx={{ "& td, & th": { px: 1, py: 0.5 } }}>
            <TableHead>
              <TableRow>
                <Sortable
                  label="On"
                  sortKey="enabled"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Symbol"
                  sortKey="symbol"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Mcap"
                  sortKey="marketCapCr"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Budget"
                  sortKey="budgetInr"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="EMA"
                  sortKey="emaPeriod"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Buf"
                  sortKey="bufferPercent"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Exit"
                  sortKey="exitBufferPercent"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Entry"
                  sortKey="entryStyle"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="State"
                  sortKey="status"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <Sortable
                  label="Stop"
                  sortKey="stop"
                  active={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {books.map(book => (
                <TableRow key={book.symbol}>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={book.enabled}
                      onChange={e => void saveBook({ ...book, enabled: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>
                    {book.symbol}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", whiteSpace: "normal", maxWidth: 180 }}
                    >
                      {[book.name, book.industry].filter(Boolean).join(" · ") || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {formatCr(book.marketCapCr)}
                    {book.marketCapAsOf ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {book.marketCapAsOf}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell align="right">{formatCr(book.budgetInr)}</TableCell>
                  <TableCell>{book.emaPeriod}</TableCell>
                  <TableCell>{book.bufferPercent}</TableCell>
                  <TableCell>{book.exitBufferPercent}</TableCell>
                  <TableCell>{book.entryStyle === "BREAK_HIGH" ? "High" : "Close"}</TableCell>
                  <TableCell>{book.paused ? "paused" : book.status}</TableCell>
                  <TableCell>{book.stop ?? "—"}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Button
                      size="small"
                      sx={{ minWidth: 0, px: 0.5 }}
                      onClick={() => setDraft(book)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      sx={{ minWidth: 0, px: 0.5 }}
                      onClick={() => void saveBook({ ...book, paused: !book.paused })}
                    >
                      {book.paused ? "Resume" : "Pause"}
                    </Button>
                    <Button
                      size="small"
                      sx={{ minWidth: 0, px: 0.5 }}
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

function formatCr(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)
}

function Sortable({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: "asc" | "desc"
  onSort: (key: SortKey) => void
}) {
  return (
    <TableCell sortDirection={active === sortKey ? dir : false}>
      <TableSortLabel
        active={active === sortKey}
        direction={active === sortKey ? dir : "asc"}
        onClick={() => onSort(sortKey)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )
}
