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
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"

import Layout from "../components/Layout"
import ScrollTable from "../components/lib/ScrollTable"
import { useSnackbar } from "../components/lib/useSnackbar"
import fetchJson from "../lib/fetchJson"
import { DEFAULT_MOMENTUM_CONFIG, type MomentumConfig } from "../lib/momentum/types"
import useUser from "../lib/useUser"

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
}

export default function MomentumPage() {
  useUser({ redirectTo: "/" })
  const { showMessage, SnackbarAlert } = useSnackbar()
  const { data, mutate } = useSWR<Report>("/api/momentum", {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })
  const [draft, setDraft] = useState<MomentumConfig | null>(null)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"all" | "pass" | "orders">("all")
  const [sortKey, setSortKey] = useState<"rank" | "symbol" | "score" | "pass" | "weight">("rank")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [busy, setBusy] = useState(false)
  const [pullWatch, setPullWatch] = useState<{
    running: boolean
    done: number
    total: number
    symbol: string | null
    errors: number
    message: string | null
    shown: boolean
  } | null>(null)
  const config = draft ?? data?.config ?? DEFAULT_MOMENTUM_CONFIG
  const rows = useMemo(() => {
    const q = query.trim().toUpperCase()
    const targets = new Set((data?.targets ?? []).map(row => row.symbol))
    const orders = new Set((data?.orders ?? []).map(row => row.symbol))
    const all = (data?.rows ?? []).filter(row => {
      if (q && !row.symbol.includes(q) && !(row.name || "").toUpperCase().includes(q)) return false
      if (view === "pass") return row.filterPass
      if (view === "orders") return targets.has(row.symbol) || orders.has(row.symbol)
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
  }, [data?.orders, data?.rows, data?.targets, query, sortDir, sortKey, view])

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

  async function pullHistory() {
    setBusy(true)
    try {
      const result = await fetchJson<{
        started: boolean
        progress: NonNullable<typeof pullWatch>
      }>("/api/momentum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull", config }),
      })
      setPullWatch(result.progress)
      if (!result.started && !result.progress.running) {
        showMessage(result.progress.message || "History pull did not start", "info")
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Pull failed", "error")
    } finally {
      setBusy(false)
    }
  }

  async function save(next: MomentumConfig = config) {
    setBusy(true)
    try {
      await fetchJson("/api/momentum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: next }),
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
      const result = await fetchJson("/api/momentum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      await mutate()
      showMessage(ok, "success")
      return result
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Request failed", "error")
      return null
    } finally {
      setBusy(false)
    }
  }

  function patch(partial: Partial<MomentumConfig>) {
    setDraft({ ...config, ...partial })
  }

  return (
    <Layout title="Momentum">
      {SnackbarAlert}
      <Stack spacing={2}>
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
        </Box>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Run
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 2,
              alignItems: "center",
            }}
          >
            <SwitchField
              label="Strategy on"
              checked={config.active}
              onChange={active => patch({ active })}
            />
            <SwitchField
              label="Pull data daily"
              checked={config.dataRefresh}
              onChange={dataRefresh => patch({ dataRefresh })}
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Execution"
              value={config.execution}
              onChange={e => patch({ execution: e.target.value as MomentumConfig["execution"] })}
            >
              <MenuItem value="report">Report only</MenuItem>
              <MenuItem value="manual">Manual send</MenuItem>
              <MenuItem value="auto">Auto on rebalance day</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="Rebalance"
              value={config.rebalance}
              helperText={
                config.rebalance === "adhoc"
                  ? "Never sends on a schedule. The order list is the buy and sell diff."
                  : config.rebalance === "monthly"
                    ? "First NSE session of the month. Weekday is only for weekly."
                    : "Sends on the weekday below."
              }
              onChange={e => patch({ rebalance: e.target.value as MomentumConfig["rebalance"] })}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="adhoc">Ad hoc</MenuItem>
            </TextField>
            {config.rebalance === "weekly" ? (
              <Num
                label="Weekday (1–5)"
                value={config.weeklyDay}
                onChange={weeklyDay => patch({ weeklyDay })}
              />
            ) : null}
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
            <TextField
              select
              fullWidth
              size="small"
              label="Rank"
              value={config.ranking}
              onChange={e => patch({ ranking: e.target.value as MomentumConfig["ranking"] })}
            >
              <MenuItem value="SHARPE_12M">12-month Sharpe</MenuItem>
              <MenuItem value="RETURN_12M">12-month return</MenuItem>
              <MenuItem value="RETURN_12_1">12-month return, skip last month</MenuItem>
            </TextField>
            <Num
              label="Max weight %"
              value={config.maxWeightPct}
              onChange={maxWeightPct => patch({ maxWeightPct })}
            />
            <Num
              label="Capital INR"
              value={config.capitalInr}
              helperText="Rupees for the whole book. 0 shows weights and buys nothing."
              onChange={capitalInr => patch({ capitalInr })}
            />
          </Box>
          <Accordion disableGutters elevation={0} sx={{ mt: 1, bgcolor: "transparent" }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Filters</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 2,
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
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Market cap"
                  helperText="Off ignores it. Strict drops a name with no stored market cap, or below the minimum. The daily refresh covers the daily-trend book, not all 750."
                  value={config.filters.marketCapFilter}
                  onChange={e =>
                    patch({
                      filters: {
                        ...config.filters,
                        marketCapFilter: e.target.value as "off" | "strict",
                      },
                    })
                  }
                >
                  <MenuItem value="off">Off</MenuItem>
                  <MenuItem value="strict">Strict</MenuItem>
                </TextField>
              </Box>
            </AccordionDetails>
          </Accordion>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button variant="contained" disabled={busy} onClick={() => void save()}>
              Save
            </Button>
            <Button disabled={busy || pullWatch?.running} onClick={() => void pullHistory()}>
              {pullWatch?.running
                ? `Pulling ${pullWatch.done} of ${pullWatch.total || "…"}`
                : "Pull history now"}
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
              onClick={() => {
                if (window.confirm("Send the current rebalance orders?")) {
                  void post({ action: "rebalance", execute: true }, "Rebalance sent")
                }
              }}
            >
              Send rebalance
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Pull history now saves these switches, then starts the download and returns at once. You
            can leave this page. The download keeps going, and the bar comes back when you return.
            It needs Strategy on. Desk → Risk is a separate switch and does not start the pull.
            Preview orders refreshes the buy and sell diff and sends nothing. Send rebalance sends
            that diff, and only after execution is Manual or Auto. Ad hoc never sends by itself: use
            Preview, then Send. Monthly sends on the first NSE session of the month. The rank uses
            the last completed daily close, not today’s candle.
          </Typography>
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
                {pullWatch.symbol ? ` (${pullWatch.symbol})` : ""}
              </Typography>
            </Box>
          ) : null}
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2">Planned orders</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Last pull {data?.lastDataPullOn ?? "never"}. Rebalance day {data?.due ? "yes" : "no"}.{" "}
            {(data?.orders ?? []).length} orders. A sell is the open quantity. A buy is
            floor(capital × weight / last completed close). Capital 0 lists no buys.
          </Typography>
          {(data?.orders ?? []).length === 0 ? (
            <Typography variant="body2">No buy or sell in the current diff.</Typography>
          ) : (
            (data?.orders ?? []).map(order => (
              <Typography key={`${order.side}-${order.symbol}`} variant="body2">
                {order.side} {order.symbol} {order.quantity} — {order.reason}
              </Typography>
            ))
          )}
        </Paper>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Filter symbol or name"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <TextField
            select
            size="small"
            label="Show"
            value={view}
            onChange={e => setView(e.target.value as "all" | "pass" | "orders")}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="all">All names</MenuItem>
            <MenuItem value="pass">Pass the filters</MenuItem>
            <MenuItem value="orders">In the order diff</MenuItem>
          </TextField>
          <Button onClick={() => exportMomentum(rows, data)}>Export this view</Button>
        </Stack>
        <ScrollTable minWidth={980}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {(
                  [
                    ["rank", "Rank"],
                    ["symbol", "Symbol"],
                    ["score", "Score"],
                    ["pass", "Filters"],
                    ["weight", "Target"],
                  ] as const
                ).map(([key, label]) => (
                  <TableCell key={key} sortDirection={sortKey === key ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === key}
                      direction={sortKey === key ? sortDir : "asc"}
                      onClick={() => {
                        if (sortKey === key)
                          setSortDir(current => (current === "asc" ? "desc" : "asc"))
                        else {
                          setSortKey(key)
                          setSortDir(key === "rank" || key === "symbol" ? "asc" : "desc")
                        }
                      }}
                    >
                      {label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>Lock</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => {
                const target = data?.targets.find(item => item.symbol === row.symbol)
                const lock = data?.locks.find(item => item.symbol === row.symbol)
                return (
                  <TableRow key={row.symbol}>
                    <TableCell>{row.rank ?? "—"}</TableCell>
                    <TableCell>
                      {row.symbol}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {row.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.metrics?.score == null ? "—" : row.metrics.score.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {row.filterPass ? (
                        <Chip size="small" color="success" label="pass" />
                      ) : (
                        row.filterReasons.join("; ")
                      )}
                    </TableCell>
                    <TableCell>
                      {target ? `${target.weightPct.toFixed(1)}% · ${target.targetQty}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() =>
                          void post(
                            {
                              action: "lock",
                              symbol: row.symbol,
                              mode: "HOLD_WEIGHT",
                              weightPct: target?.weightPct ?? config.maxWeightPct,
                            },
                            `${row.symbol} weight held`
                          )
                        }
                      >
                        Hold
                      </Button>
                      <Button
                        size="small"
                        onClick={() =>
                          void post(
                            { action: "lock", symbol: row.symbol, mode: "EXCLUDE", weightPct: 0 },
                            `${row.symbol} excluded`
                          )
                        }
                      >
                        Exclude
                      </Button>
                      {lock ? (
                        <Button
                          size="small"
                          onClick={() =>
                            void post(
                              { action: "lock", symbol: row.symbol, clear: true },
                              "Lock cleared"
                            )
                          }
                        >
                          {lock.mode}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollTable>
        <Typography variant="caption" color="text.secondary">
          Showing {rows.length} of {data?.rows.length ?? 0}. Pass the filters is the names that
          clear every filter. In the order diff is the names with a target weight or a buy or sell.
          Spec: docs/strategies/MOMENTUM.md
        </Typography>
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

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 40 }}>
      <Switch checked={checked} onChange={e => onChange(e.target.checked)} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  )
}

function Num({
  label,
  value,
  helperText,
  onChange,
}: {
  label: string
  value: number
  helperText?: string
  onChange: (value: number) => void
}) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      helperText={helperText}
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    />
  )
}
