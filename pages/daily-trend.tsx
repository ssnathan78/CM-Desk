import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import PauseIcon from "@mui/icons-material/Pause"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
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
import { SettingsSelectField, SettingsTextField } from "../components/forms/SettingsFields"
import Layout from "../components/Layout"
import ConfirmAction from "../components/lib/ConfirmAction"
import PageSection from "../components/lib/PageSection"
import ScrollTable from "../components/lib/ScrollTable"
import StrategyTablePagination from "../components/lib/StrategyTablePagination"
import TableColumnMenu from "../components/lib/TableColumnMenu"
import { useSnackbar } from "../components/lib/useSnackbar"
import { StrategyPermissionLine } from "../components/strategy/StrategyPermissionLine"
import {
  type DailyTrendBulkPatch,
  type DailyTrendInlineRowPatch,
  mergeDailyTrendBookSave,
  parseOptionalDailyTrendBulkForm,
} from "../lib/dailyTrend/engine"
import { DAILY_TREND_FIELD_HELP } from "../lib/dailyTrend/fieldHelp"
import {
  DAILY_TREND_TABLE_COLUMNS,
  DAILY_TREND_VISIBLE_COLUMNS_KEY,
  type DailyTrendTableColumnId,
  dailyTrendColumnsInOrder,
} from "../lib/dailyTrend/tableColumns"
import fetchJson from "../lib/fetchJson"
import {
  type ActionOutcome,
  dailyTrendEvaluateNotice,
  removeDailyTrendConfirm,
  symbolOffConfirm,
  unsavedRuntimeNote,
} from "../lib/operatorActionCopy"
import {
  defaultVisibleIds,
  readVisibleColumns,
  writeVisibleColumns,
} from "../lib/ui/columnVisibility"
import { paginateSlice } from "../lib/ui/tablePagination"
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
  active?: boolean
  execution?: "report" | "manual" | "auto"
  decisions?: {
    symbol: string
    action: string
    reason: string
    state?: string
    submitted?: { ok: boolean; message: string } | null
  }[]
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
    "apply-all" | "evaluate-send" | "turn-on" | "turn-off" | "turn-off-selected" | null
  >(null)
  const [pendingOff, setPendingOff] = useState<Book | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [evaluateOutcome, setEvaluateOutcome] = useState<ActionOutcome | null>(null)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => new Set())
  const [rowEdits, setRowEdits] = useState<Record<string, DailyTrendInlineRowPatch>>({})
  const [visibleColumns, setVisibleColumns] = useState<DailyTrendTableColumnId[]>(() =>
    defaultVisibleIds(DAILY_TREND_TABLE_COLUMNS)
  )
  const [tablePage, setTablePage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const runtime = data ? (config ?? data.config) : null

  useEffect(() => {
    setVisibleColumns(
      readVisibleColumns(DAILY_TREND_VISIBLE_COLUMNS_KEY, DAILY_TREND_TABLE_COLUMNS)
    )
  }, [])

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

  async function setSelectedEnabled(enabled: boolean) {
    if (!selectedSymbols.size) {
      showMessage("Select at least one symbol.", "info")
      return
    }
    setBusy(true)
    try {
      const result = await fetchJson<{ count: number }>("/api/daily-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-enabled-selected",
          enabled,
          symbols: [...selectedSymbols],
        }),
      })
      await mutate()
      showMessage(
        `${enabled ? "Turned on" : "Turned off"} ${result.count} selected symbol(s)`,
        "success"
      )
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
    setTablePage(0)
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

  const tableCols = dailyTrendColumnsInOrder(visibleColumns)
  const pageBooks = useMemo(
    () => paginateSlice(books, tablePage, rowsPerPage),
    [books, tablePage, rowsPerPage]
  )

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
        message="Send the daily-trend orders this evaluation wants? Saved execution is used. Report only sends nothing."
        confirmLabel="Evaluate and send"
        outcome={evaluateOutcome}
        onCancel={() => {
          setPendingConfirm(null)
          setEvaluateOutcome(null)
        }}
        onConfirm={async () => {
          setBusy(true)
          try {
            const result = await fetchJson<Payload>("/api/daily-trend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "evaluate", execute: true }),
            })
            setDecisions(result.decisions ?? [])
            await mutate()
            setEvaluateOutcome(
              dailyTrendEvaluateNotice({
                execute: true,
                active: result.active !== false,
                savedExecution: result.execution ?? data?.config.execution ?? "report",
                decisions: result.decisions ?? [],
              })
            )
          } catch (error) {
            setEvaluateOutcome({
              severity: "error",
              text: error instanceof Error ? error.message : "Evaluate failed",
            })
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
        tone="attention"
        title={symbolOffConfirm((data?.books ?? []).map(book => book.symbol)).title}
        message={symbolOffConfirm((data?.books ?? []).map(book => book.symbol)).message}
        confirmLabel="Turn all off"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          setPendingConfirm(null)
          await setEverySymbol(false)
        }}
      />
      <ConfirmAction
        open={pendingConfirm === "turn-off-selected"}
        tone="attention"
        title={symbolOffConfirm([...selectedSymbols]).title}
        message={symbolOffConfirm([...selectedSymbols]).message}
        confirmLabel="Turn off"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          setPendingConfirm(null)
          await setSelectedEnabled(false)
        }}
      />
      <ConfirmAction
        open={Boolean(pendingOff)}
        tone="attention"
        title={pendingOff ? symbolOffConfirm([pendingOff.symbol]).title : "Turn off?"}
        message={pendingOff ? symbolOffConfirm([pendingOff.symbol]).message : ""}
        confirmLabel="Turn off"
        onCancel={() => setPendingOff(null)}
        onConfirm={async () => {
          const book = pendingOff
          setPendingOff(null)
          if (book) await saveBook({ ...book, enabled: false })
        }}
      />
      <ConfirmAction
        open={Boolean(pendingRemove)}
        tone="attention"
        title={pendingRemove ? removeDailyTrendConfirm(pendingRemove).title : "Remove?"}
        message={pendingRemove ? removeDailyTrendConfirm(pendingRemove).message : ""}
        confirmLabel="Remove from list"
        onCancel={() => setPendingRemove(null)}
        onConfirm={async () => {
          const symbol = pendingRemove
          setPendingRemove(null)
          if (!symbol) return
          try {
            await fetchJson("/api/daily-trend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "remove-book", symbol }),
            })
            await mutate()
            showMessage(`${symbol} removed from the list. Shares at the broker stay.`, "info")
          } catch (error) {
            showMessage(error instanceof Error ? error.message : "Could not remove", "error")
          }
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
              engineOn={data?.config.active ?? false}
              pageExecutionLabel={
                data?.config.execution === "manual"
                  ? "Manual send"
                  : data?.config.execution === "auto"
                    ? "Auto"
                    : "Report only"
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
            {data?.config
              ? (() => {
                  const note = unsavedRuntimeNote(
                    { active: data.config.active, execution: data.config.execution },
                    { active: runtime.active, execution: runtime.execution }
                  )
                  return note ? (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>
                      {note}
                    </Alert>
                  ) : null
                })()
              : null}
            <DailyTrendEngineToolbar
              runtime={runtime}
              sendEnabled={data?.config.execution !== "report"}
              busy={busy}
              pull={pull ?? null}
              onPatch={patch => setConfig({ ...runtime, ...patch })}
              onSave={() => void saveRuntime()}
              onPullHistory={() => void pullHistory()}
              onPullMissing={() => void pullHistory(true)}
              onEvaluate={() => {
                void (async () => {
                  try {
                    const result = await fetchJson<Payload>("/api/daily-trend", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "evaluate", execute: false }),
                    })
                    setDecisions(result.decisions ?? [])
                    const notice = dailyTrendEvaluateNotice({
                      execute: false,
                      active: result.active !== false,
                      savedExecution: result.execution ?? data?.config.execution ?? "report",
                      decisions: result.decisions ?? [],
                    })
                    showMessage(notice.text, notice.severity)
                  } catch (error) {
                    showMessage(error instanceof Error ? error.message : "Evaluate failed", "error")
                  }
                })()
              }}
              onEvaluateSend={() => {
                setEvaluateOutcome(null)
                setPendingConfirm("evaluate-send")
              }}
            />
          </PageSection>
        )}
        <PageSection
          title="Symbol book"
          description="Add names and bulk-patch settings. Filters and the table are in the next section."
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ alignItems: { md: "flex-end" }, mb: 1.5, flexWrap: "wrap" }}
          >
            <SettingsTextField
              label="Add symbol (NSE cash)"
              helper={DAILY_TREND_FIELD_HELP.addSymbol}
              helperPlacement="tooltip"
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
            writes every symbol. Checked rows show unsaved budget, EMA, and buffer until Save
            selected. Turn selected off is fully dark for those symbols: no new buy and no stop. The
            stored stop price is kept. Pause is separate and still allows the stop.
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
              helper={DAILY_TREND_FIELD_HELP.bulkEma}
              helperPlacement="tooltip"
              value={bulk.emaPeriod}
              onChange={emaPeriod => setBulk({ ...bulk, emaPeriod })}
            />
            <SettingsTextField
              label="Buffer %"
              helper={DAILY_TREND_FIELD_HELP.bulkBuffer}
              helperPlacement="tooltip"
              value={bulk.bufferPercent}
              onChange={bufferPercent => setBulk({ ...bulk, bufferPercent })}
            />
            <SettingsTextField
              label="Exit %"
              helper={DAILY_TREND_FIELD_HELP.bulkExit}
              helperPlacement="tooltip"
              value={bulk.exitBufferPercent}
              onChange={exitBufferPercent => setBulk({ ...bulk, exitBufferPercent })}
            />
            <SettingsTextField
              label="Budget INR"
              helper={DAILY_TREND_FIELD_HELP.bulkBudget}
              helperPlacement="tooltip"
              value={bulk.budgetInr}
              onChange={budgetInr => setBulk({ ...bulk, budgetInr })}
            />
            <SettingsSelectField
              label="Entry"
              helper={DAILY_TREND_FIELD_HELP.bulkEntry}
              helperPlacement="tooltip"
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
              onClick={() => void setSelectedEnabled(true)}
            >
              Turn selected on ({selectedSymbols.size})
            </Button>
            <Button
              variant="outlined"
              disabled={busy || selectedSymbols.size === 0}
              onClick={() => setPendingConfirm("turn-off-selected")}
            >
              Turn selected off ({selectedSymbols.size})
            </Button>
            <Button
              variant="outlined"
              disabled={busy || selectedSymbols.size === 0}
              onClick={() => void saveSelectedRows()}
            >
              Save selected ({selectedSymbols.size})
            </Button>
          </Stack>
        </PageSection>
        <DailyTrendBookDrawer
          open={Boolean(editBook)}
          book={editBook}
          busy={busy}
          onClose={() => setEditBook(null)}
          onSave={async book => {
            if (!editBook) return
            await saveBook({ ...editBook, ...book, symbol: editBook.symbol })
          }}
        />
        <PageSection
          title="Book table"
          description="Filter, select rows, and edit inline. Wide table scrolls horizontally; optional columns in the header menu."
          flush
          actions={
            <TableColumnMenu
              columns={DAILY_TREND_TABLE_COLUMNS}
              visible={visibleColumns}
              onChange={cols => {
                setVisibleColumns(cols)
                writeVisibleColumns(DAILY_TREND_VISIBLE_COLUMNS_KEY, cols)
              }}
            />
          }
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 220px" },
              gap: 2,
              px: 2,
              pb: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <SettingsTextField
              label="Filter symbol, name, or industry"
              helper={DAILY_TREND_FIELD_HELP.filter}
              helperPlacement="tooltip"
              value={filter}
              onChange={value => {
                setFilter(value)
                setTablePage(0)
              }}
            />
            <SettingsSelectField<"all" | "qualifies">
              label="Signal"
              helper={DAILY_TREND_FIELD_HELP.signalView}
              helperPlacement="tooltip"
              value={signalView}
              onChange={value => {
                setSignalView(value)
                setTablePage(0)
              }}
            >
              <MenuItem value="all">All names</MenuItem>
              <MenuItem value="qualifies">Qualifies</MenuItem>
            </SettingsSelectField>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 2, pb: 1 }}
          >
            Market cap refreshes about 20 names an hour from Screener. Hover Close or Mcap for
            session dates. Select rows for budget, EMA period, and buffer; use Edit for exit buffer
            and entry.
          </Typography>
          <ScrollTable minWidth={1100}>
            <Table stickyHeader size="small" sx={{ "& td, & th": { px: 1, py: 0.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...pin(0, 3), width: 40, minWidth: 40 }}>
                    <Checkbox
                      size="small"
                      indeterminate={
                        pageBooks.some(book => selectedSymbols.has(book.symbol)) &&
                        !pageBooks.every(book => selectedSymbols.has(book.symbol))
                      }
                      checked={
                        pageBooks.length > 0 &&
                        pageBooks.every(book => selectedSymbols.has(book.symbol))
                      }
                      onChange={(_, checked) => {
                        setSelectedSymbols(current => {
                          const next = new Set(current)
                          for (const book of pageBooks) {
                            if (checked) next.add(book.symbol)
                            else next.delete(book.symbol)
                          }
                          return next
                        })
                      }}
                      slotProps={{ input: { "aria-label": "Select symbols on this page" } }}
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
                  {tableCols.map(colId => {
                    const meta = DAILY_TREND_TABLE_COLUMNS.find(c => c.id === colId)
                    const columnSortKey = DAILY_TREND_COLUMN_SORT[colId]
                    return (
                      <Sortable
                        key={colId}
                        label={meta?.label ?? colId}
                        sortKey={columnSortKey}
                        active={sortKey}
                        dir={sortDir}
                        onSort={toggleSort}
                      />
                    )
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {pageBooks.map(book => {
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
                          slotProps={{ input: { "aria-label": `On ${book.symbol}` } }}
                          onChange={e => {
                            if (e.target.checked) void saveBook({ ...book, enabled: true })
                            else setPendingOff(book)
                          }}
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
                        <Tooltip
                          title={
                            book.paused
                              ? "Resume new buys. The stop still sells."
                              : "Pause new buys. The stop still sells."
                          }
                        >
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
                        <Tooltip title="Remove from list. Shares at the broker stay.">
                          <IconButton
                            size="small"
                            aria-label={`Remove ${book.symbol}`}
                            onClick={() => setPendingRemove(book.symbol)}
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
                      {tableCols.map(colId =>
                        dailyTrendDataCell(colId, book, selected, patch, patchRow)
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
          <StrategyTablePagination
            count={books.length}
            page={tablePage}
            rowsPerPage={rowsPerPage}
            onPageChange={setTablePage}
            onRowsPerPageChange={setRowsPerPage}
          />
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

const DAILY_TREND_COLUMN_SORT: Record<DailyTrendTableColumnId, SortKey> = {
  status: "status",
  close: "close",
  ema: "ema",
  signal: "signal",
  stop: "stop",
  name: "name",
  industry: "industry",
  marketCapCr: "marketCapCr",
  budgetInr: "budgetInr",
  emaPeriod: "emaPeriod",
  bufferPercent: "bufferPercent",
  exitBufferPercent: "exitBufferPercent",
  entryStyle: "entryStyle",
}

function dailyTrendDataCell(
  colId: DailyTrendTableColumnId,
  book: Book,
  selected: boolean,
  patch: { budgetInr: number; emaPeriod: number; bufferPercent: number },
  patchRow: (
    symbol: string,
    book: Book,
    field: "budgetInr" | "emaPeriod" | "bufferPercent",
    raw: string
  ) => void
) {
  switch (colId) {
    case "status":
      return <TableCell key={colId}>{book.paused ? "paused" : book.status}</TableCell>
    case "close":
      return (
        <TableCell key={colId} align="right" sx={{ whiteSpace: "nowrap" }}>
          <CellWithTip
            tip={closeCellTip(book)}
            align="right"
            label={book.close == null ? "—" : formatPx(book.close)}
          />
        </TableCell>
      )
    case "ema":
      return (
        <TableCell key={colId} align="right">
          {book.ema == null ? "—" : formatPx(book.ema)}
        </TableCell>
      )
    case "signal":
      return (
        <TableCell key={colId}>
          <Chip
            size="small"
            color={book.signalBuy ? "success" : "default"}
            label={book.signal ?? "—"}
          />
        </TableCell>
      )
    case "stop":
      return <TableCell key={colId}>{book.stop ?? "—"}</TableCell>
    case "name":
      return <TableCell key={colId}>{book.name || "—"}</TableCell>
    case "industry":
      return <TableCell key={colId}>{book.industry || "—"}</TableCell>
    case "marketCapCr":
      return (
        <TableCell key={colId} align="right" sx={{ whiteSpace: "nowrap" }}>
          <CellWithTip
            tip={book.marketCapAsOf ? `Market cap as of ${book.marketCapAsOf}` : undefined}
            align="right"
            label={formatCr(book.marketCapCr)}
          />
        </TableCell>
      )
    case "budgetInr":
      return (
        <TableCell key={colId} align="right">
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
      )
    case "emaPeriod":
      return (
        <TableCell key={colId}>
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
      )
    case "bufferPercent":
      return (
        <TableCell key={colId}>
          {selected ? (
            <TextField
              size="small"
              type="number"
              value={patch.bufferPercent}
              onChange={e => patchRow(book.symbol, book, "bufferPercent", e.target.value)}
              sx={{ width: 72, "& .MuiInputBase-root": { py: 0.25 } }}
            />
          ) : (
            book.bufferPercent
          )}
        </TableCell>
      )
    case "exitBufferPercent":
      return <TableCell key={colId}>{book.exitBufferPercent}</TableCell>
    case "entryStyle":
      return (
        <TableCell key={colId}>{book.entryStyle === "BREAK_HIGH" ? "High" : "Close"}</TableCell>
      )
    default:
      return null
  }
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
