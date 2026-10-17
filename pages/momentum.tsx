import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"

import {
  SettingsNumberField,
  SettingsSelectField,
  SettingsSwitchField,
} from "../components/forms/SettingsFields"
import Layout from "../components/Layout"
import ConfirmAction from "../components/lib/ConfirmAction"
import PageSection from "../components/lib/PageSection"
import ScrollTable from "../components/lib/ScrollTable"
import StrategyTablePagination from "../components/lib/StrategyTablePagination"
import TableColumnMenu from "../components/lib/TableColumnMenu"
import { useSnackbar } from "../components/lib/useSnackbar"
import { StrategyPermissionLine } from "../components/strategy/StrategyPermissionLine"
import fetchJson from "../lib/fetchJson"
import { diffRebalancePreview } from "../lib/momentum/rebalanceDiff"
import { DEFAULT_MOMENTUM_CONFIG, type MomentumConfig } from "../lib/momentum/types"
import type { ColumnDef } from "../lib/ui/columnVisibility"
import {
  defaultVisibleIds,
  readVisibleColumns,
  writeVisibleColumns,
} from "../lib/ui/columnVisibility"
import { paginateSlice } from "../lib/ui/tablePagination"
import useUser from "../lib/useUser"

const VISIBLE_COLUMNS_KEY = "momentum.visibleColumns"

type MomentumColumnKey =
  | "rank"
  | "symbol"
  | "score"
  | "pass"
  | "weight"
  | "price"
  | "roc12"
  | "roc24"
  | "pctBelowHigh"
  | "aboveSma"

const MOMENTUM_TABLE_COLUMNS: ColumnDef<MomentumColumnKey>[] = [
  { id: "rank", label: "Rank" },
  { id: "symbol", label: "Symbol", locked: true },
  { id: "score", label: "Score" },
  { id: "pass", label: "Filters" },
  { id: "weight", label: "Target" },
  { id: "price", label: "Close", defaultVisible: false },
  { id: "roc12", label: "ROC 12m", defaultVisible: false },
  { id: "roc24", label: "ROC 24m", defaultVisible: false },
  { id: "pctBelowHigh", label: "% below high", defaultVisible: false },
  { id: "aboveSma", label: "Above SMA", defaultVisible: false },
]

const MOMENTUM_COLUMN_ORDER: MomentumColumnKey[] = MOMENTUM_TABLE_COLUMNS.map(col => col.id)

function momentumColumnsInOrder(visible: MomentumColumnKey[]): MomentumColumnKey[] {
  const allowed = new Set(MOMENTUM_COLUMN_ORDER)
  return visible.filter(id => allowed.has(id))
}

const SORTABLE_MOMENTUM_COLUMNS = new Set<MomentumColumnKey>([
  "rank",
  "symbol",
  "score",
  "pass",
  "weight",
])

function momentumColumnLabel(key: MomentumColumnKey) {
  return MOMENTUM_TABLE_COLUMNS.find(col => col.id === key)?.label ?? key
}

type ReportRow = {
  symbol: string
  name?: string
  rank: number | null
  filterPass: boolean
  filterReasons: string[]
  price: number | null
  metrics: {
    score: number | null
    roc12: number | null
    roc24: number | null
    pctBelowHigh: number | null
    aboveSma: boolean | null
  } | null
}

type Report = {
  active: boolean
  config: MomentumConfig
  due?: boolean
  rows: ReportRow[]
  targets: {
    symbol: string
    weightPct: number
    targetQty: number
    heldQty: number
    locked: boolean
  }[]
  orders: { symbol: string; side: string; quantity: number; reason: string }[]
  locks: { symbol: string; mode: string; weightPct: number }[]
  lastDataPullOn: string | null
  computedAt?: string | null
}

export default function MomentumPage() {
  useUser({ redirectTo: "/" })
  const { showMessage } = useSnackbar()
  const { data, mutate } = useSWR<Report>("/api/momentum", {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })
  const [draft, setDraft] = useState<MomentumConfig | null>(null)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<
    | "all"
    | "pass"
    | "orders"
    | "hold"
    | "exclude"
    | "locked"
    | "unlocked"
    | "hasTarget"
  >("all")
  const [sortKey, setSortKey] = useState<"rank" | "symbol" | "score" | "pass" | "weight">("rank")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [trimPct, setTrimPct] = useState(10)
  const [pendingOrder, setPendingOrder] = useState<"rebalance" | "deploy" | "trim" | null>(null)
  const [previewOrders, setPreviewOrders] = useState<Report["orders"] | null>(null)
  const [previewDiff, setPreviewDiff] = useState<ReturnType<typeof diffRebalancePreview> | null>(
    null
  )
  const lastPreviewRef = useRef<Report["orders"] | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<MomentumColumnKey[]>(() =>
    defaultVisibleIds(MOMENTUM_TABLE_COLUMNS)
  )
  const [pullWatch, setPullWatch] = useState<{
    running: boolean
    done: number
    total: number
    symbol: string | null
    errors: number
    scope?: "trend" | "momentum" | "all" | null
    message: string | null
    shown: boolean
  } | null>(null)
  const config = data ? (draft ?? data.config) : null
  const locksRef = useRef<Report["locks"]>([])
  const lockQueue = useRef(Promise.resolve())
  const rankTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (data?.locks) locksRef.current = data.locks
  }, [data?.locks])
  useEffect(
    () => () => {
      if (rankTimer.current) clearTimeout(rankTimer.current)
    },
    []
  )
  useEffect(() => {
    setVisibleColumns(readVisibleColumns(VISIBLE_COLUMNS_KEY, MOMENTUM_TABLE_COLUMNS))
  }, [])

  const tableColumns = momentumColumnsInOrder(visibleColumns)
  const rows = useMemo(() => {
    const q = query.trim().toUpperCase()
    const targets = new Set((data?.targets ?? []).map(row => row.symbol))
    const orders = new Set((data?.orders ?? []).map(row => row.symbol))
    const lockBySymbol = new Map((data?.locks ?? []).map(lock => [lock.symbol, lock]))
    const all = (data?.rows ?? []).filter(row => {
      if (q && !row.symbol.includes(q) && !(row.name || "").toUpperCase().includes(q)) return false
      const lock = lockBySymbol.get(row.symbol)
      if (view === "pass") return row.filterPass
      if (view === "orders") return targets.has(row.symbol) || orders.has(row.symbol)
      if (view === "hold") return lock?.mode === "HOLD_WEIGHT"
      if (view === "exclude") return lock?.mode === "EXCLUDE"
      if (view === "locked") return Boolean(lock)
      if (view === "unlocked") return !lock
      if (view === "hasTarget") return targets.has(row.symbol)
      return true
    })
    const dir = sortDir === "asc" ? 1 : -1
    return all.slice().sort((a, b) => {
      const weight = (symbol: string) =>
        data?.targets.find(row => row.symbol === symbol)?.weightPct ?? -1
      const left =
        sortKey === "symbol"
          ? a.symbol
          : sortKey === "score"
            ? (a.metrics?.score ?? Number.NEGATIVE_INFINITY)
            : sortKey === "pass"
              ? a.filterPass
                ? 1
                : 0
              : sortKey === "weight"
                ? weight(a.symbol)
                : (a.rank ?? 10_000)
      const right =
        sortKey === "symbol"
          ? b.symbol
          : sortKey === "score"
            ? (b.metrics?.score ?? Number.NEGATIVE_INFINITY)
            : sortKey === "pass"
              ? b.filterPass
                ? 1
                : 0
              : sortKey === "weight"
                ? weight(b.symbol)
                : (b.rank ?? 10_000)
      if (typeof left === "number" && typeof right === "number") return (left - right) * dir
      return String(left).localeCompare(String(right)) * dir
    })
  }, [data?.locks, data?.orders, data?.rows, data?.targets, query, sortDir, sortKey, view])
  const pageRows = useMemo(
    () => paginateSlice(rows, page, rowsPerPage),
    [rows, page, rowsPerPage]
  )

  useEffect(() => {
    let cancelled = false
    void fetchJson<NonNullable<typeof pullWatch>>("/api/momentum?view=pull")
      .then(latest => {
        if (!cancelled && (latest.running || latest.shown)) setPullWatch(latest)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pullWatch?.running) return
    const timer = setInterval(() => {
      void fetchJson<NonNullable<typeof pullWatch>>("/api/momentum?view=pull").then(latest => {
        setPullWatch(latest)
        if (!latest.running) {
          showMessage(
            latest.message || "History pull finished",
            latest.errors ? "error" : "success"
          )
          void mutate()
        }
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [mutate, pullWatch?.running, showMessage])

  async function pullHistory(onlyMissing = false) {
    setBusy(true)
    try {
      const result = await fetchJson<{
        started: boolean
        progress: NonNullable<typeof pullWatch>
      }>("/api/momentum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull", config, onlyMissing }),
      })
      if (!result.started && result.progress.scope === "trend") {
        showMessage(
          `Daily trend is downloading its own list, ${result.progress.done} of ${result.progress.total}. This page starts after that finishes.`,
          "info"
        )
      } else {
        setPullWatch(result.progress)
        if (!result.started && !result.progress.running) {
          showMessage(result.progress.message || "History pull did not start", "info")
        }
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Pull failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function save(next?: MomentumConfig) {
    const payload = next ?? config
    if (!payload) return
    setBusy(true)
    try {
      await fetchJson("/api/momentum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: payload }),
      })
      setDraft(null)
      await mutate()
      showMessage("Momentum settings saved", "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Save failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true)
    try {
      const result = await fetchJson<{
        orders?: Report["orders"]
        preview?: boolean
        message?: string
      }>("/api/momentum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (body.execute === false && Array.isArray(result.orders)) {
        setPreviewDiff(diffRebalancePreview(lastPreviewRef.current ?? previewOrders, result.orders))
        lastPreviewRef.current = result.orders
        setPreviewOrders(result.orders)
      } else if (
        body.action === "rebalance" ||
        body.action === "deploy" ||
        body.action === "trim"
      ) {
        setPreviewOrders(null)
        setPreviewDiff(null)
        lastPreviewRef.current = null
      }
      await mutate()
      showMessage(result.message || ok, result.message ? "info" : "success")
      return result
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Request failed", "error")
      return null
    } finally {
      setBusy(false)
    }
  }

  function patch(partial: Partial<MomentumConfig>) {
    const base = draft ?? data?.config ?? DEFAULT_MOMENTUM_CONFIG
    setDraft({ ...base, ...partial })
  }

  function rememberLocks(locks: Report["locks"]) {
    locksRef.current = locks
    void mutate(current => (current ? { ...current, locks } : current), { revalidate: false })
  }

  function scheduleRank() {
    if (rankTimer.current) clearTimeout(rankTimer.current)
    rankTimer.current = setTimeout(() => {
      void lockQueue.current.then(() => mutate())
    }, 1500)
  }

  function changeLock(symbol: string, next: Report["locks"][number] | null) {
    const current = locksRef.current
    rememberLocks(
      next
        ? [...current.filter(row => row.symbol !== symbol), next]
        : current.filter(row => row.symbol !== symbol)
    )
    lockQueue.current = lockQueue.current
      .then(async () => {
        await fetchJson("/api/momentum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            next
              ? { action: "lock", symbol, mode: next.mode, weightPct: next.weightPct }
              : { action: "lock", symbol, clear: true }
          ),
        })
      })
      .catch(error => {
        showMessage(error instanceof Error ? error.message : "Could not save the lock", "error")
        void mutate()
      })
    scheduleRank()
  }

  return (
    <Layout title="Momentum">
      <ConfirmAction
        open={pendingOrder === "rebalance"}
        tone="attention"
        title="Send rebalance?"
        message="Send the current rebalance orders?"
        confirmLabel="Send rebalance"
        onCancel={() => setPendingOrder(null)}
        onConfirm={async () => {
          setPendingOrder(null)
          await post({ action: "rebalance", execute: true }, "Rebalance sent")
        }}
      />
      <ConfirmAction
        open={pendingOrder === "deploy"}
        tone="attention"
        title="Deploy spare cash?"
        message="Buy an equal share of the spare cash for each name in today's book?"
        confirmLabel="Deploy"
        onCancel={() => setPendingOrder(null)}
        onConfirm={async () => {
          setPendingOrder(null)
          await post({ action: "deploy", execute: true }, "Deploy sent")
        }}
      />
      <ConfirmAction
        open={pendingOrder === "trim"}
        tone="attention"
        title="Trim book?"
        message={`Sell ${trimPct}% of each open momentum position and reduce Capital INR by the same percent?`}
        confirmLabel="Trim book"
        onCancel={() => setPendingOrder(null)}
        onConfirm={async () => {
          setPendingOrder(null)
          await post({ action: "trim", execute: true, trimPct }, "Trim sent")
        }}
      />
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <Typography variant="h5" sx={{ flex: 1 }}>
              Cash momentum
            </Typography>
            <Button component={Link} href="/help/momentum" size="small">
              Guide
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Ranks the stored Nifty Total Market list from daily candles. The book calculates only
            until you change execution from report. Desk → Risk still has to enable Momentum before
            any order is accepted, and a disabled strategy does not sell either. History pull runs
            only while this page is on and data refresh is on.
          </Typography>
          {config ? (
            <StrategyPermissionLine
              strategyKey="MOMENTUM"
              engineOn={config.active}
              pageExecutionLabel={
                config.execution === "report"
                  ? "Report only"
                  : config.execution === "manual"
                    ? "Manual send"
                    : "Auto on rebalance day"
              }
              extra={
                config.rebalance === "adhoc"
                  ? "Rebalance: Ad hoc"
                  : config.rebalance === "monthly"
                    ? "Rebalance: Monthly"
                    : "Rebalance: Weekly"
              }
            />
          ) : (
            <Skeleton variant="text" width="70%" />
          )}
        </Box>
        {!config ? (
          <PageSection title="Run & filters">
            <Skeleton height={200} />
          </PageSection>
        ) : (
          <PageSection
            title="Run & filters"
            description="Engine, rebalance schedule, universe size, weights, and optional entry filters."
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 0,
                columnGap: 3,
                rowGap: 0,
                width: "100%",
              }}
            >
              <Box>
                <SwitchField
                  label="Engine on"
                  checked={config.active}
                  onChange={active => patch({ active })}
                />
                <SwitchField
                  label="Pull data daily"
                  checked={config.dataRefresh}
                  onChange={dataRefresh => patch({ dataRefresh })}
                />
                <SettingsSelectField
                  label="Execution"
                  value={config.execution}
                  onChange={execution => patch({ execution })}
                >
                  <MenuItem value="report">Report only</MenuItem>
                  <MenuItem value="manual">Manual send</MenuItem>
                  <MenuItem value="auto">Auto on rebalance day</MenuItem>
                </SettingsSelectField>
                <SettingsSelectField
                  label="Rebalance"
                  value={config.rebalance}
                  helper={
                    config.rebalance === "adhoc"
                      ? "Never sends on a schedule. The order list is the buy and sell diff."
                      : config.rebalance === "monthly"
                        ? "First NSE session of the month. Weekday is only for weekly."
                        : "Sends on the weekday below."
                  }
                  onChange={rebalance => patch({ rebalance })}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="adhoc">Ad hoc</MenuItem>
                </SettingsSelectField>
                {config.rebalance === "weekly" ? (
                  <Num
                    label="Weekday (1–5)"
                    value={config.weeklyDay}
                    onChange={weeklyDay => patch({ weeklyDay })}
                  />
                ) : null}
              </Box>
              <Box>
                <Num
                  label="Holdings"
                  value={config.holdingsCount}
                  onChange={holdingsCount => patch({ holdingsCount })}
                />
                <Num
                  label="Worst rank held"
                  value={config.worstRankHeld}
                  onChange={worstRankHeld => patch({ worstRankHeld })}
                />
                <Num
                  label="Entry rank max"
                  value={config.entryRankMax}
                  onChange={entryRankMax => patch({ entryRankMax })}
                />
                <SettingsSelectField
                  label="Rank"
                  value={config.ranking}
                  onChange={ranking => patch({ ranking })}
                >
                  <MenuItem value="SHARPE_12M">12-month Sharpe</MenuItem>
                  <MenuItem value="RETURN_12M">12-month return</MenuItem>
                  <MenuItem value="RETURN_12_1">12-month return, skip last month</MenuItem>
                </SettingsSelectField>
                <SettingsSelectField
                  label="Weights"
                  value={config.weighting}
                  helper={
                    config.weighting === "drift"
                      ? "Held shares stay put. A name is sold when it leaves the book, or when it grows past the trim level. New rupees buy only names you do not hold yet."
                      : "Each rebalance resizes every name to the same slice of capital."
                  }
                  onChange={weighting => patch({ weighting })}
                >
                  <MenuItem value="equal">Equal weight each rebalance</MenuItem>
                  <MenuItem value="drift">Let winners run</MenuItem>
                </SettingsSelectField>
                <Num
                  label="Max weight %"
                  value={config.maxWeightPct}
                  helperText={
                    config.weighting === "drift"
                      ? "Caps a new name. It does not trim a share you already hold."
                      : undefined
                  }
                  onChange={maxWeightPct => patch({ maxWeightPct })}
                />
                {config.weighting === "drift" ? (
                  <>
                    <Num
                      label="Trim above % of book"
                      value={config.trimAbovePct}
                      onChange={trimAbovePct => patch({ trimAbovePct })}
                    />
                    <Num
                      label="Trim down to %"
                      value={config.trimToPct}
                      helperText="New capital buys a new name up to one equal slice. It is not added to shares you already hold. Leftover rupees wait for the next new name."
                      onChange={trimToPct => patch({ trimToPct })}
                    />
                  </>
                ) : null}
                <Num
                  label="Capital INR"
                  value={config.capitalInr}
                  helperText="Rupees for the whole book. 0 shows weights and buys nothing."
                  onChange={capitalInr => patch({ capitalInr })}
                />
              </Box>
            </Box>
            <Accordion disableGutters elevation={0} sx={{ mt: 1, bgcolor: "transparent" }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Filters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    columnGap: 3,
                    rowGap: 0,
                    alignItems: "start",
                  }}
                >
                  <Num
                    label="12-month multiple cap"
                    value={config.filters.maxPriceMultiple12m}
                    onChange={maxPriceMultiple12m =>
                      patch({ filters: { ...config.filters, maxPriceMultiple12m } })
                    }
                  />
                  <Num
                    label="24-month multiple cap"
                    value={config.filters.maxPriceMultiple24m}
                    onChange={maxPriceMultiple24m =>
                      patch({ filters: { ...config.filters, maxPriceMultiple24m } })
                    }
                  />
                  <Num
                    label="Max % below high"
                    value={config.filters.maxPctBelowHigh}
                    onChange={maxPctBelowHigh =>
                      patch({ filters: { ...config.filters, maxPctBelowHigh } })
                    }
                  />
                  <Num
                    label="Min turnover INR"
                    value={config.filters.minAvgTurnoverInr}
                    helperText="Mean of close × volume over the last 21 sessions, after a history pull."
                    helperPlacement="tooltip"
                    onChange={minAvgTurnoverInr =>
                      patch({ filters: { ...config.filters, minAvgTurnoverInr } })
                    }
                  />
                  <Num
                    label="SMA days"
                    value={config.filters.smaPeriod}
                    onChange={smaPeriod => patch({ filters: { ...config.filters, smaPeriod } })}
                  />
                  <Num
                    label="1-month / 12-month cap"
                    value={config.filters.maxOneMonthShare}
                    onChange={maxOneMonthShare =>
                      patch({ filters: { ...config.filters, maxOneMonthShare } })
                    }
                  />
                  <SettingsSelectField
                    label="Market cap"
                    helper="Off ignores it. Strict drops a name with no stored market cap, or below the minimum. The daily refresh covers the daily-trend book, not all 750."
                    helperPlacement="tooltip"
                    value={config.filters.marketCapFilter}
                    onChange={marketCapFilter =>
                      patch({
                        filters: {
                          ...config.filters,
                          marketCapFilter,
                        },
                      })
                    }
                  >
                    <MenuItem value="off">Off</MenuItem>
                    <MenuItem value="strict">Strict</MenuItem>
                  </SettingsSelectField>
                </Box>
              </AccordionDetails>
            </Accordion>
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
              <Button variant="contained" disabled={busy} onClick={() => void save()}>
                Save
              </Button>
              <Button disabled={busy || pullWatch?.running} onClick={() => void pullHistory()}>
                {pullWatch?.running
                  ? `Pulling ${pullWatch.done} of ${pullWatch.total || "…"}`
                  : "Pull history now"}
              </Button>
              <Button disabled={busy || pullWatch?.running} onClick={() => void pullHistory(true)}>
                Retry missing
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void post({ action: "rebalance", execute: false }, "Preview refreshed")
                }
              >
                Preview orders
              </Button>
              <Button
                color="warning"
                disabled={busy || config.execution === "report"}
                onClick={() => setPendingOrder("rebalance")}
              >
                Send rebalance
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              Save writes the switches. Pull history saves them and starts the download. Preview
              lists orders and sends nothing. Send needs Manual or Auto.
            </Typography>
            {config.weighting === "drift" ? (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Drift cash</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", alignItems: "center" }}
                  >
                    <Button
                      disabled={busy || data?.config.weighting !== "drift"}
                      onClick={() =>
                        void post({ action: "deploy", execute: false }, "Deploy preview refreshed")
                      }
                    >
                      Preview deploy
                    </Button>
                    <Button
                      color="warning"
                      disabled={
                        busy || data?.config.weighting !== "drift" || config.execution === "report"
                      }
                      onClick={() => setPendingOrder("deploy")}
                    >
                      Deploy spare cash
                    </Button>
                    <Num
                      label="Trim book %"
                      value={trimPct}
                      onChange={value => setTrimPct(Math.min(99, Math.max(1, Math.round(value))))}
                    />
                    <Button
                      disabled={busy || data?.config.weighting !== "drift"}
                      onClick={() =>
                        void post(
                          { action: "trim", execute: false, trimPct },
                          "Trim preview refreshed"
                        )
                      }
                    >
                      Preview trim
                    </Button>
                    <Button
                      color="warning"
                      disabled={
                        busy || data?.config.weighting !== "drift" || config.execution === "report"
                      }
                      onClick={() => setPendingOrder("trim")}
                    >
                      Trim book
                    </Button>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
                    Deploy and trim run only when weights are Let winners run. They recompute their
                    own orders and do not replace the stored rank.
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ) : null}
            {pullWatch?.running || pullWatch?.shown ? (
              <Box sx={{ mt: 1.5 }}>
                {pullWatch.running ? (
                  <LinearProgress
                    variant={pullWatch.total > 0 ? "determinate" : "indeterminate"}
                    value={
                      pullWatch.total > 0 ? Math.round((100 * pullWatch.done) / pullWatch.total) : 0
                    }
                  />
                ) : null}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {pullWatch.message}
                </Typography>
              </Box>
            ) : null}
          </PageSection>
        )}
        <PageSection
          title="Universe & orders"
          description="Filter the ranked list, preview rebalance diff, and export."
          flush
          actions={
            <TableColumnMenu
              columns={MOMENTUM_TABLE_COLUMNS}
              visible={visibleColumns}
              onChange={cols => {
                setVisibleColumns(cols)
                writeVisibleColumns(VISIBLE_COLUMNS_KEY, cols)
              }}
            />
          }
        >
          <Box sx={{ px: 2, pb: 1 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ alignItems: { sm: "center" } }}
            >
              <TextField
                size="small"
                label="Filter symbol or name"
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
              />
              <TextField
                select
                size="small"
                label="Show"
                value={view}
                onChange={e => {
                  setView(
                    e.target.value as
                      | "all"
                      | "pass"
                      | "orders"
                      | "hold"
                      | "exclude"
                      | "locked"
                      | "unlocked"
                      | "hasTarget"
                  )
                  setPage(0)
                }}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="all">All names</MenuItem>
                <MenuItem value="pass">Pass the filters</MenuItem>
                <MenuItem value="orders">In the order diff</MenuItem>
                <MenuItem value="hasTarget">Has target weight</MenuItem>
                <MenuItem value="hold">Hold lock</MenuItem>
                <MenuItem value="exclude">Exclude lock</MenuItem>
                <MenuItem value="locked">Any lock</MenuItem>
                <MenuItem value="unlocked">No lock</MenuItem>
              </TextField>
              <Button onClick={() => exportMomentum(rows, data)}>Export this view</Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {(previewOrders ?? data?.orders ?? []).length} planned. Last pull{" "}
              {data?.lastDataPullOn ?? "never"}. Rank as of{" "}
              {data?.computedAt
                ? new Date(data.computedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                : "not stored"}
              . Rebalance day {data?.due ? "yes" : "no"}.
            </Typography>
            {previewDiff &&
            (previewDiff.added.length ||
              previewDiff.removed.length ||
              previewDiff.changed.length) ? (
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={`Preview diff: ${previewDiff.summary}`}
              />
            ) : null}
            {(previewOrders ?? data?.orders ?? []).length > 0 ? (
              <Box sx={{ maxHeight: 140, overflow: "auto" }}>
                {(previewOrders ?? data?.orders ?? []).map(order => (
                  <Typography key={`${order.side}-${order.symbol}`} variant="body2">
                    {order.side} {order.symbol} {order.quantity} — {order.reason}
                  </Typography>
                ))}
              </Box>
            ) : null}
          </Box>
          <ScrollTable minWidth={720}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {tableColumns.map(key => (
                    <TableCell key={key} sortDirection={sortKey === key ? sortDir : false}>
                      {SORTABLE_MOMENTUM_COLUMNS.has(key) ? (
                        <TableSortLabel
                          active={sortKey === key}
                          direction={sortKey === key ? sortDir : "asc"}
                          onClick={() => {
                            if (sortKey === key)
                              setSortDir(current => (current === "asc" ? "desc" : "asc"))
                            else {
                              setSortKey(key as typeof sortKey)
                              setSortDir(key === "rank" || key === "symbol" ? "asc" : "desc")
                            }
                            setPage(0)
                          }}
                        >
                          {momentumColumnLabel(key)}
                        </TableSortLabel>
                      ) : (
                        momentumColumnLabel(key)
                      )}
                    </TableCell>
                  ))}
                  <TableCell
                    sx={{
                      position: "sticky",
                      right: 0,
                      zIndex: 2,
                      bgcolor: "background.paper",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Lock
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map(row => {
                  const target = data?.targets.find(item => item.symbol === row.symbol)
                  const lock = data?.locks.find(item => item.symbol === row.symbol)
                  return (
                    <TableRow key={row.symbol}>
                      {tableColumns.map(key => (
                        <TableCell key={key} sx={key === "pass" ? { maxWidth: 280 } : undefined}>
                          {key === "rank" ? (
                            (row.rank ?? "—")
                          ) : key === "symbol" ? (
                            <>
                              {row.symbol}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block" }}
                              >
                                {row.name}
                              </Typography>
                            </>
                          ) : key === "score" ? (
                            row.metrics?.score == null ? (
                              "—"
                            ) : (
                              row.metrics.score.toFixed(2)
                            )
                          ) : key === "pass" ? (
                            row.filterPass ? (
                              <Chip size="small" color="success" label="pass" />
                            ) : (
                              row.filterReasons.join("; ")
                            )
                          ) : key === "weight" ? (
                            target ? (
                              `${target.weightPct.toFixed(1)}% · ${target.targetQty}`
                            ) : (
                              "—"
                            )
                          ) : key === "price" ? (
                            row.price == null ? (
                              "—"
                            ) : (
                              row.price.toFixed(2)
                            )
                          ) : key === "roc12" ? (
                            row.metrics?.roc12 == null ? (
                              "—"
                            ) : (
                              `${(row.metrics.roc12 * 100).toFixed(1)}%`
                            )
                          ) : key === "roc24" ? (
                            row.metrics?.roc24 == null ? (
                              "—"
                            ) : (
                              `${(row.metrics.roc24 * 100).toFixed(1)}%`
                            )
                          ) : key === "pctBelowHigh" ? (
                            row.metrics?.pctBelowHigh == null ? (
                              "—"
                            ) : (
                              `${(row.metrics.pctBelowHigh * 100).toFixed(1)}%`
                            )
                          ) : key === "aboveSma" ? (
                            row.metrics?.aboveSma == null ? (
                              "—"
                            ) : row.metrics.aboveSma ? (
                              "yes"
                            ) : (
                              "no"
                            )
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      ))}
                      <TableCell
                        sx={{
                          position: "sticky",
                          right: 0,
                          zIndex: 1,
                          bgcolor: "background.paper",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lock ? (
                          <Button size="small" onClick={() => changeLock(row.symbol, null)}>
                            {lock.mode === "EXCLUDE" ? "Clear exclude" : "Clear hold"}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="small"
                              onClick={() =>
                                changeLock(row.symbol, {
                                  symbol: row.symbol,
                                  mode: "HOLD_WEIGHT",
                                  weightPct: target?.weightPct ?? config?.maxWeightPct ?? 0,
                                })
                              }
                            >
                              Hold
                            </Button>
                            <Button
                              size="small"
                              onClick={() =>
                                changeLock(row.symbol, {
                                  symbol: row.symbol,
                                  mode: "EXCLUDE",
                                  weightPct: 0,
                                })
                              }
                            >
                              Exclude
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
          <StrategyTablePagination
            count={rows.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={setRowsPerPage}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 2, pt: 1 }}
          >
            {rows.length} match this view, of {data?.rows.length ?? 0} names. Pass the filters is
            the names that clear every filter. In the order diff is the names with a target weight
            or a buy or sell.
          </Typography>
        </PageSection>
      </Stack>
    </Layout>
  )
}

function exportMomentum(rows: Report["rows"], data: Report | undefined) {
  const header = [
    "rank",
    "symbol",
    "name",
    "score",
    "pass",
    "reasons",
    "weightPct",
    "targetQty",
    "order",
  ]
  const lines = [header.join(",")]
  for (const row of rows) {
    const target = data?.targets.find(item => item.symbol === row.symbol)
    const order = data?.orders.find(item => item.symbol === row.symbol)
    lines.push(
      [
        row.rank ?? "",
        row.symbol,
        `"${(row.name || "").replace(/"/g, "")}"`,
        row.metrics?.score ?? "",
        row.filterPass ? "yes" : "no",
        `"${row.filterReasons.join("; ").replace(/"/g, "")}"`,
        target?.weightPct ?? "",
        target?.targetQty ?? "",
        order ? `${order.side} ${order.quantity}` : "",
      ].join(",")
    )
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "momentum.csv"
  link.click()
  URL.revokeObjectURL(link.href)
}

function SwitchField(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return <SettingsSwitchField {...props} />
}

function Num(props: {
  label: string
  value: number
  helperText?: string
  helperPlacement?: "below" | "tooltip"
  onChange: (value: number) => void
}) {
  return (
    <SettingsNumberField
      label={props.label}
      value={props.value}
      helper={props.helperText}
      helperPlacement={props.helperPlacement}
      onChange={props.onChange}
    />
  )
}
