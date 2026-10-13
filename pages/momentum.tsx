import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
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
import { useMemo, useState } from "react"
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
  const { data, mutate } = useSWR<Report>("/api/momentum")
  const [draft, setDraft] = useState<MomentumConfig | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const config = draft ?? data?.config ?? DEFAULT_MOMENTUM_CONFIG
  const rows = useMemo(() => {
    const q = query.trim().toUpperCase()
    const all = data?.rows ?? []
    return q
      ? all.filter(row => row.symbol.includes(q) || (row.name || "").toUpperCase().includes(q))
      : all
  }, [data?.rows, query])

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
          <Typography variant="h5">Cash momentum</Typography>
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
              onChange={e => patch({ rebalance: e.target.value as MomentumConfig["rebalance"] })}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="adhoc">Ad hoc</MenuItem>
            </TextField>
            <Num
              label="Weekday (1–5)"
              value={config.weeklyDay}
              onChange={weeklyDay => patch({ weeklyDay })}
            />
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
                  label="Circuit count"
                  value={config.filters.circuitFilter}
                  onChange={e =>
                    patch({
                      filters: {
                        ...config.filters,
                        circuitFilter: e.target.value as "off" | "strict",
                      },
                    })
                  }
                >
                  <MenuItem value="off">Off</MenuItem>
                  <MenuItem value="strict">Strict</MenuItem>
                </TextField>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Market cap"
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
            <Button
              disabled={busy}
              onClick={() => void post({ action: "pull" }, "History pull finished")}
            >
              Pull history now
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
            Last pull {data?.lastDataPullOn ?? "never"}. Rebalance day {data?.due ? "yes" : "no"}.
            Targets {data?.targets.length ?? 0}. Preview orders {data?.orders.length ?? 0}. A
            hold-weight lock is not bought back up to equal weight. Exclude keeps the name out and
            sells it if it is held.
          </Typography>
        </Paper>
        <TextField
          size="small"
          label="Filter symbol or name"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <ScrollTable>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Filters</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>Lock</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(0, 80).map(row => {
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
          Showing {Math.min(80, rows.length)} of {rows.length}. Spec: docs/strategies/MOMENTUM.md
        </Typography>
      </Stack>
    </Layout>
  )
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
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    />
  )
}
