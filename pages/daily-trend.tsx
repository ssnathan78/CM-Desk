import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import PauseIcon from "@mui/icons-material/Pause"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import DailyTrendBookDrawer from "../components/daily-trend/DailyTrendBookDrawer"
import DailyTrendEngineToolbar from "../components/daily-trend/DailyTrendEngineToolbar"
import {
  SettingsSelectField,
  SettingsSwitchField,
  SettingsTextField,
} from "../components/forms/SettingsFields"
import Layout from "../components/Layout"
import ConfirmAction from "../components/lib/ConfirmAction"
import PageSection from "../components/lib/PageSection"
import ScrollTable from "../components/lib/ScrollTable"
import { useSnackbar } from "../components/lib/useSnackbar"
import { StrategyPermissionLine } from "../components/strategy/StrategyPermissionLine"
import {
  type DailyTrendBulkPatch,
  type DailyTrendInlineRowPatch,
  mergeDailyTrendBookSave,
  parseOptionalDailyTrendBulkForm,
} from "../lib/dailyTrend/engine"
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
  close?: number | null
  closeDate?: string | null
  storedClose?: number | null
  storedDate?: string | null
  ema?: number | null
  signal?: string
  signalBuy?: boolean
  signalQualifies?: boolean
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
  | "close"
  | "ema"
  | "signal"
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
  pull?: {
    running: boolean
    done: number
    total: number
    symbol: string | null
    errors: number
    message: string | null
    shown: boolean
  }
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
  const { showMessage } = useSnackbar()
  const { data, mutate } = useSWR<Payload>("/api/daily-trend")
  const [config, setConfig] = useState<Payload["config"] | null>(null)
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [busy, setBusy] = useState(false)
  const [decisions, setDecisions] = useState<Payload["decisions"]>([])
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("")
  const [signalView, setSignalView] = useState<"all" | "qualifies">("all")
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
  const [pendingConfirm, setPendingConfirm] = useState<
    "apply-all" | "evaluate-send" | "turn-on" | "turn-off" | null
  >(null)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => new Set())
  const [rowEdits, setRowEdits] = useState<Record<string, DailyTrendInlineRowPatch>>({})
  const runtime = data ? (config ?? data.config) : null

  function bulkPatchFromBar(): DailyTrendBulkPatch | { error: string } {
    const parsed = parseOptionalDailyTrendBulkForm(bulk)
    if (!parsed.ok) return { error: parsed.error }
    return parsed.patch
  }

  function mergedBookSettings(book: Book) {
    const bulkPart = bulkPatchFromBar()
    const bulk: DailyTrendBulkPatch = "error" in bulkPart ? {} : bulkPart
    const inline = rowEdits[book.symbol] ?? {}
    return mergeDailyTrendBookSave(book, bulk, inline)
  }

  function rowPatch(book: Book) {
    const merged = mergedBookSettings(book)
    return {
      budgetInr: merged.budgetInr,
      emaPeriod: merged.emaPeriod,
      bufferPercent: merged.bufferPercent,
    }
  }

  function bookForDrawer(book: Book): Book {
    const merged = mergedBookSettings(book)
    return { ...book, ...merged }
  }

  function patchRow(
    symbol: string,
    _book: Book,
    field: "budgetInr" | "emaPeriod" | "bufferPercent",
    raw: string
  ) {
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setRowEdits(current => ({
      ...current,
      [symbol]: { ...current[symbol], [field]: value },
    }))
  }

  async function saveSelectedRows() {
    if (!selectedSymbols.size) {
      showMessage("Select at least one symbol to save.", "info")
      return
    }
    const bulkPart = bulkPatchFromBar()
    if ("error" in bulkPart) {
      showMessage(bulkPart.error, "error")
      return
    }
    setBusy(true)
    try {
      const symbols = [...selectedSymbols]
      await Promise.all(
        symbols.map(async symbol => {
          const book = data?.books.find(row => row.symbol === symbol)
          if (!book) return
          const merged = mergeDailyTrendBookSave(book, bulkPart, rowEdits[symbol] ?? {})
          await fetchJson("/api/daily-trend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save-book", ...book, ...merged }),
          })
        })
      )
      setRowEdits(current => {
        const next = { ...current }
        for (const symbol of symbols) delete next[symbol]
        return next
      })
      if (Object.keys(bulkPart).length > 0) {
        setBulk({
          emaPeriod: "",
          bufferPercent: "",
          exitBufferPercent: "",
          budgetInr: "",
          entryStyle: "",
        })
      }
      await mutate()
      showMessage(`Saved ${symbols.length} symbol(s)`, "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Batch save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  function toggleSelected(symbol: string, on: boolean) {
    setSelectedSymbols(current => {
      const next = new Set(current)
      if (on) next.add(symbol)
      else next.delete(symbol)
      return next
    })
  }

  function toggleAllVisible(on: boolean) {
    setSelectedSymbols(current => {
      const next = new Set(current)
      for (const book of books) {
        if (on) next.add(book.symbol)
        else next.delete(book.symbol)
      }
      return next
    })
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
      setEditBook(null)
      setRowEdits(current => {
        if (!book.symbol) return current
        const next = { ...current }
        delete next[book.symbol]
        return next
      })
      setMatches(current => current.filter(row => row.symbol !== book.symbol))
      await mutate()
      showMessage(`${book.symbol} saved`, "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function setEverySymbol(enabled: boolean) {
    setBusy(true)
    try {
      const result = await fetchJson<{ count: number }>("/api/daily-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-enabled-all", enabled }),
      })
      await mutate()
      showMessage(`${enabled ? "Turned on" : "Turned off"} ${result.count} symbols`, "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Update failed", "error")
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
    setPendingConfirm("apply-all")
    return
  }

  async function applyToAllConfirmed() {
    const body: Record<string, unknown> = { action: "apply-all" }
    if (bulk.emaPeriod !== "") body.emaPeriod = Number(bulk.emaPeriod)
    if (bulk.bufferPercent !== "") body.bufferPercent = Number(bulk.bufferPercent)
    if (bulk.exitBufferPercent !== "") body.exitBufferPercent = Number(bulk.exitBufferPercent)
    if (bulk.budgetInr !== "") body.budgetInr = Number(bulk.budgetInr)
    if (bulk.entryStyle !== "") body.entryStyle = bulk.entryStyle
    setPendingConfirm(null)
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
      setSortDir(key === "marketCapCr" || key === "enabled" || key === "signal" ? "desc" : "asc")
    }
  }

  const books = useMemo(() => {
    const q = filter.trim().toUpperCase()
    const rows = (data?.books ?? []).filter(book => {
      if (signalView === "qualifies" && !book.signalQualifies) return false
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
      if (sortKey === "signal") return book.signalBuy ? 2 : book.signalQualifies ? 1 : 0
      if (sortKey === "status") return book.paused ? `paused ${book.status}` : book.status
      if (
        sortKey === "marketCapCr" ||
        sortKey === "stop" ||
        sortKey === "budgetInr" ||
        sortKey === "close" ||
        sortKey === "ema"
      )
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
  }, [data?.books, filter, signalView, sortDir, sortKey])

  useEffect(() => {
    if (!data?.pull?.running) return
    const timer = setInterval(() => {
      void mutate()
    }, 2000)
    return () => clearInterval(timer)
  }, [data?.pull?.running, mutate])

  async function pullHistory(onlyMissing = false) {
    setBusy(true)
    try {
      const result = await fetchJson<{
        started: boolean
        progress: {
          running: boolean
          message: string | null
          scope?: string | null
          done: number
          total: number
        }
      }>("/api/daily-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull", onlyMissing }),
      })
      await mutate()
      if (!result.started && result.progress.scope === "momentum") {
        showMessage(
          `Momentum is downloading its own list, ${result.progress.done} of ${result.progress.total}. This page starts after that finishes.`,
          "info"
        )
      } else if (!result.started && !result.progress.running) {
        showMessage(result.progress.message || "History pull did not start", "info")
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Pull failed", "error")
    } finally {
      setBusy(false)
    }
  }

  const pull = data?.pull

  const bookCount = data?.books.length ?? 0

  return (
    <Layout title="Daily trend">
      <ConfirmAction
        open={pendingConfirm === "apply-all"}
        title="Apply to all symbols?"
        message={`Apply these settings to all ${bookCount} symbols? On/off, pause, status, and stops stay as they are.`}
        confirmLabel="Apply to all"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => applyToAllConfirmed()}
      />
      <ConfirmAction
        open={pendingConfirm === "evaluate-send"}
        tone="attention"
        title="Evaluate and send?"
        message="Send the daily-trend orders this evaluation wants?"
        confirmLabel="Evaluate and send"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          setPendingConfirm(null)
          setBusy(true)
          try {
            const result = await fetchJson<Payload>("/api/daily-trend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "evaluate", execute: true }),
            })
            setDecisions(result.decisions ?? [])
            await mutate()
            showMessage("Evaluate-and-send finished", "success")
          } catch (error) {
            showMessage(error instanceof Error ? error.message : "Evaluate failed", "error")
          } finally {
            setBusy(false)
          }
        }}
      />
      <ConfirmAction
        open={pendingConfirm === "turn-on"}
        title="Turn all symbols on?"
        message={`Turn all ${bookCount} symbols on? A symbol that is on can buy when execution is Manual or Auto and Desk → Risk allows daily trend.`}
        confirmLabel="Turn all on"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          setPendingConfirm(null)
          await setEverySymbol(true)
        }}
      />
      <ConfirmAction
        open={pendingConfirm === "turn-off"}
        title="Turn all symbols off?"
        message={`Turn all ${bookCount} symbols off? Off is fully dark: no new buy and no stop. Shares already at the broker stay there.`}
        confirmLabel="Turn all off"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          setPendingConfirm(null)
          await setEverySymbol(false)
        }}
      />
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <Typography variant="h5" sx={{ flex: 1 }}>
              Daily long-only trend
            </Typography>
            <Button component={Link} href="/help/daily-trend" size="small">
              Guide
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Same idea as the Chase long side, on the cash symbol and on daily candles. There is no
            short. A buy is sent only after the close is above the EMA plus the buffer. The stop is
            the lower of the EMA and that day&apos;s low, and a later close through it sells the
            open quantity. A flat book does not sell. Report mode never sends that order. Each
            symbol has its own on/off switch. Desk → Risk → Daily trend has to be enabled before an
            order is accepted.
          </Typography>
          {runtime ? (
            <StrategyPermissionLine
              strategyKey="DAILY_TREND"
              engineOn={runtime.active}
              pageExecutionLabel={
                runtime.execution === "report"
                  ? "Report only"
                  : runtime.execution === "manual"
                    ? "Manual send"
                    : "Auto"
              }
            />
          ) : (
            <Skeleton variant="text" width="70%" />
          )}
        </Box>
        {!runtime ? (
          <PageSection title="Engine & execution">
            <Skeleton height={120} />
          </PageSection>
        ) : (
          <PageSection title="Engine & execution">
            <DailyTrendEngineToolbar
              runtime={runtime}
              busy={busy}
              pull={pull ?? null}
              onPatch={patch => setConfig({ ...runtime, ...patch })}
              onSave={() => void saveRuntime()}
              onPullHistory={() => void pullHistory()}
              onPullMissing={() => void pullHistory(true)}
              onEvaluate={() =>
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
              onEvaluateSend={() => setPendingConfirm("evaluate-send")}
            />
          </PageSection>
        )}
        <PageSection
          title="Symbol book"
          description="Add names, bulk-patch settings, then filter the list below."
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ alignItems: { md: "flex-end" }, mb: 1.5, flexWrap: "wrap" }}
          >
            <SettingsTextField
              label="Add symbol (NSE cash)"
              placeholder="RELIANCE, Mahindra, NIFTYBEES"
              value={query}
              onChange={setQuery}
              onKeyDown={e => {
                if (e.key === "Enter") void searchSymbols()
              }}
            />
            <Button variant="outlined" disabled={busy} onClick={() => void searchSymbols()}>
              Search
            </Button>
          </Stack>
          {matches.length ? (
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
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
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Bulk patch: fill only fields to change. Blank leaves each symbol unchanged. Apply to all
            writes every symbol. Save selected also applies filled bulk fields to checked rows
            (inline cells win over bulk for budget, EMA, and buffer). Does not change on/off, pause,
            status, or stop.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 0,
              columnGap: 3,
            }}
          >
            <SettingsTextField
              label="EMA"
              value={bulk.emaPeriod}
              onChange={emaPeriod => setBulk({ ...bulk, emaPeriod })}
            />
            <SettingsTextField
              label="Buffer %"
              value={bulk.bufferPercent}
              onChange={bufferPercent => setBulk({ ...bulk, bufferPercent })}
            />
            <SettingsTextField
              label="Exit %"
              value={bulk.exitBufferPercent}
              onChange={exitBufferPercent => setBulk({ ...bulk, exitBufferPercent })}
            />
            <SettingsTextField
              label="Budget INR"
              value={bulk.budgetInr}
              onChange={budgetInr => setBulk({ ...bulk, budgetInr })}
            />
            <SettingsSelectField
              label="Entry"
              value={bulk.entryStyle || ""}
              onChange={entryStyle => setBulk({ ...bulk, entryStyle })}
            >
              <MenuItem value="">Leave as is</MenuItem>
              <MenuItem value="CLOSE_CROSS">Close cross</MenuItem>
              <MenuItem value="BREAK_HIGH">Break high</MenuItem>
            </SettingsSelectField>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 1.5, flexWrap: "wrap", alignItems: "center" }}
          >
            <Button variant="outlined" disabled={busy} onClick={() => void applyToAll()}>
              Apply to all
            </Button>
            <Button variant="outlined" disabled={busy} onClick={() => setPendingConfirm("turn-on")}>
              Turn all on
            </Button>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => setPendingConfirm("turn-off")}
            >
              Turn all off
            </Button>
            <Button
              variant="outlined"
              disabled={busy || selectedSymbols.size === 0}
              onClick={() => void saveSelectedRows()}
            >
              Save selected ({selectedSymbols.size})
            </Button>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 220px" },
              gap: 2,
              mt: 2,
            }}
          >
            <SettingsTextField
              label="Filter symbol, name, or industry"
              value={filter}
              onChange={setFilter}
            />
            <SettingsSelectField<"all" | "qualifies">
              label="Signal"
              value={signalView}
              onChange={setSignalView}
            >
              <MenuItem value="all">All names</MenuItem>
              <MenuItem value="qualifies">Qualifies</MenuItem>
            </SettingsSelectField>
          </Box>
        </PageSection>
        <DailyTrendBookDrawer
          open={Boolean(editBook)}
          book={editBook}
          busy={busy}
          onClose={() => setEditBook(null)}
          onSave={async book => {
            await saveBook({ ...editBook!, ...book, symbol: editBook!.symbol })
          }}
        />
        <PageSection
          title="Book table"
          description="Wide table scrolls horizontally with the page; use jump buttons for price vs budget columns."
          flush
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 2, pb: 1 }}
          >
            Market cap refreshes about 20 names an hour from Screener. Hover Close or Mcap for
            session dates. Select rows for budget, EMA period, and buffer; use Edit for exit buffer
            and entry. Jump to Price & signals after scrolling to budget columns.
          </Typography>
          <ScrollTable
            minWidth={1100}
            scrollControls
            scrollStartLabel="Price & signals"
            scrollEndLabel="Budget & settings"
          >
            <Table stickyHeader size="small" sx={{ "& td, & th": { px: 1, py: 0.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...pin(0, 3), width: 40, minWidth: 40 }}>
                    <Checkbox
                      size="small"
                      indeterminate={
                        selectedSymbols.size > 0 && selectedSymbols.size < books.length
                      }
                      checked={books.length > 0 && selectedSymbols.size === books.length}
                      onChange={(_, checked) => toggleAllVisible(checked)}
                      slotProps={{ input: { "aria-label": "Select all visible symbols" } }}
                    />
                  </TableCell>
                  <Sortable
                    label="On"
                    sortKey="enabled"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    sx={{ ...pin(40, 3), width: 48, minWidth: 48 }}
                  />
                  <TableCell sx={{ ...pin(88, 3), width: 100, minWidth: 100 }} />
                  <Sortable
                    label="Symbol"
                    sortKey="symbol"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    sx={{
                      ...pin(188, 3),
                      width: 96,
                      minWidth: 96,
                      boxShadow: "8px 0 8px -8px rgba(0,0,0,0.5)",
                    }}
                  />
                  <Sortable
                    label="State"
                    sortKey="status"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Sortable
                    label="Close"
                    sortKey="close"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Sortable
                    label="EMA"
                    sortKey="ema"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Sortable
                    label="Signal"
                    sortKey="signal"
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
                  <Sortable
                    label="Name"
                    sortKey="name"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Sortable
                    label="Industry"
                    sortKey="industry"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Sortable
                    label="Mcap ₹ cr"
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
                    label="Buffer"
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
                </TableRow>
              </TableHead>
              <TableBody>
                {books.map(book => {
                  const selected = selectedSymbols.has(book.symbol)
                  const patch = rowPatch(book)
                  return (
                    <TableRow key={book.symbol} selected={selected}>
                      <TableCell sx={{ ...pin(0), width: 40, minWidth: 40 }}>
                        <Checkbox
                          size="small"
                          checked={selected}
                          onChange={(_, checked) => toggleSelected(book.symbol, checked)}
                          slotProps={{ input: { "aria-label": `Select ${book.symbol}` } }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...pin(40), width: 48, minWidth: 48 }}>
                        <Switch
                          size="small"
                          checked={book.enabled}
                          onChange={e => void saveBook({ ...book, enabled: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ ...pin(88), whiteSpace: "nowrap", width: 100, minWidth: 100 }}
                      >
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setEditBook(bookForDrawer(book))}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={book.paused ? "Resume" : "Pause"}>
                          <IconButton
                            size="small"
                            onClick={() => void saveBook({ ...book, paused: !book.paused })}
                          >
                            {book.paused ? (
                              <PlayArrowIcon fontSize="small" />
                            ) : (
                              <PauseIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove">
                          <IconButton
                            size="small"
                            onClick={() =>
                              void fetchJson("/api/daily-trend", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "remove-book",
                                  symbol: book.symbol,
                                }),
                              }).then(() => mutate())
                            }
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell
                        sx={{
                          ...pin(188),
                          width: 96,
                          minWidth: 96,
                          boxShadow: "8px 0 8px -8px rgba(0,0,0,0.5)",
                        }}
                      >
                        {book.symbol}
                      </TableCell>
                      <TableCell>{book.paused ? "paused" : book.status}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <CellWithTip
                          tip={closeCellTip(book)}
                          align="right"
                          label={book.close == null ? "—" : formatPx(book.close)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {book.ema == null ? "—" : formatPx(book.ema)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={book.signalBuy ? "success" : "default"}
                          label={book.signal ?? "—"}
                        />
                      </TableCell>
                      <TableCell>{book.stop ?? "—"}</TableCell>
                      <TableCell>{book.name || "—"}</TableCell>
                      <TableCell>{book.industry || "—"}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <CellWithTip
                          tip={
                            book.marketCapAsOf
                              ? `Market cap as of ${book.marketCapAsOf}`
                              : undefined
                          }
                          align="right"
                          label={formatCr(book.marketCapCr)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {selected ? (
                          <TextField
                            size="small"
                            type="number"
                            value={patch.budgetInr}
                            onChange={e => patchRow(book.symbol, book, "budgetInr", e.target.value)}
                            sx={{ width: 96, "& .MuiInputBase-root": { py: 0.25 } }}
                          />
                        ) : (
                          formatCr(book.budgetInr)
                        )}
                      </TableCell>
                      <TableCell>
                        {selected ? (
                          <TextField
                            size="small"
                            type="number"
                            value={patch.emaPeriod}
                            onChange={e => patchRow(book.symbol, book, "emaPeriod", e.target.value)}
                            sx={{ width: 72, "& .MuiInputBase-root": { py: 0.25 } }}
                          />
                        ) : (
                          book.emaPeriod
                        )}
                      </TableCell>
                      <TableCell>
                        {selected ? (
                          <TextField
                            size="small"
                            type="number"
                            value={patch.bufferPercent}
                            onChange={e =>
                              patchRow(book.symbol, book, "bufferPercent", e.target.value)
                            }
                            sx={{ width: 72, "& .MuiInputBase-root": { py: 0.25 } }}
                          />
                        ) : (
                          book.bufferPercent
                        )}
                      </TableCell>
                      <TableCell>{book.exitBufferPercent}</TableCell>
                      <TableCell>{book.entryStyle === "BREAK_HIGH" ? "High" : "Close"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
        </PageSection>
        {(decisions ?? []).length > 0 ? (
          <PageSection title="Last evaluation">
            {decisions?.map(row => (
              <Typography key={row.symbol} variant="body2">
                {row.symbol}: {row.action} — {row.reason}
              </Typography>
            ))}
          </PageSection>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          Spec: docs/strategies/DAILY_TREND.md
        </Typography>
      </Stack>
    </Layout>
  )
}

function formatPx(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCr(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)
}

function closeCellTip(book: Book): string | undefined {
  const lines: string[] = []
  if (book.closeDate) lines.push(`Last completed session: ${book.closeDate}`)
  if (book.storedClose != null && book.storedDate) {
    lines.push(`${formatPx(book.storedClose)} on ${book.storedDate} waits for the next session`)
  }
  return lines.length ? lines.join(" · ") : undefined
}

function CellWithTip({
  label,
  tip,
  align,
}: {
  label: string
  tip?: string
  align?: "left" | "right"
}) {
  if (!tip) return <>{label}</>
  return (
    <Tooltip title={tip}>
      <Box
        component="span"
        sx={{
          display: "inline-block",
          width: align === "right" ? "100%" : undefined,
          textAlign: align,
          borderBottom: "1px dotted",
          borderColor: "text.disabled",
          cursor: "help",
        }}
      >
        {label}
      </Box>
    </Tooltip>
  )
}

function pin(left: number, z = 1) {
  return {
    position: "sticky" as const,
    left,
    top: z > 1 ? 0 : undefined,
    zIndex: z,
    bgcolor: "background.paper",
  }
}

function Sortable({
  label,
  sortKey,
  active,
  dir,
  onSort,
  sx,
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: "asc" | "desc"
  onSort: (key: SortKey) => void
  sx?: object
}) {
  return (
    <TableCell sortDirection={active === sortKey ? dir : false} sx={sx}>
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
