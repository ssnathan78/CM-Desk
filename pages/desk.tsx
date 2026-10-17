import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import useSWR from "swr"
import DueSchedules from "../components/DueSchedules"
import AlertsPanel from "../components/desk/AlertsPanel"
import ContractsPanel from "../components/desk/ContractsPanel"
import HistoryPeriod from "../components/desk/HistoryPeriod"
import IndexLists from "../components/desk/IndexLists"
import RiskControls from "../components/desk/RiskControls"
import SignalsPanel from "../components/desk/SignalsPanel"
import StrategyReconcile from "../components/desk/StrategyReconcile"
import Layout from "../components/Layout"
import ConfirmDialog from "../components/lib/ConfirmDialog"
import ScrollTable from "../components/lib/ScrollTable"
import TradesForDay from "../components/TradesForDay"
import fetchJson from "../lib/fetchJson"
import { type FlattenOpenResult, flattenOperatorNotice } from "../lib/flattenNotice"
import type { FeedClearMode } from "../lib/trading/feedWindow"
import { type HistoryPreset, historyRange } from "../lib/trading/historyRange"
import { DEFAULT_RISK_SETTINGS } from "../lib/trading/riskEngine"
import { groupStrategyRealized } from "../lib/trading/todayGroups"
import type { PositionView } from "../lib/trading/types"
import useUser from "../lib/useUser"
import Figure from "../components/figures/Figure"
import {
  formatInr,
  formatIstDateTime,
} from "../lib/format"

const deskTileSx = {
  textAlign: "left" as const,
  font: "inherit",
  color: "inherit",
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
  borderRadius: 1,
  px: 1,
  py: 0.5,
  cursor: "pointer",
  minWidth: 0,
}

function orderPriceLabel(row: Record<string, unknown>) {
  const bits: string[] = []
  const avg = Number(row.averageFillPrice)
  const stop = Number(row.stopPrice)
  const limit = Number(row.limitPrice)
  if (Number.isFinite(avg) && avg > 0) bits.push(`Avg ${formatInr(row.averageFillPrice as string)}`)
  if (Number.isFinite(stop) && stop > 0) bits.push(`SL ${formatInr(row.stopPrice as string)}`)
  if (Number.isFinite(limit) && limit > 0) bits.push(`Lmt ${formatInr(row.limitPrice as string)}`)
  return bits.length ? bits.join(" · ") : "—"
}

const filterFieldSx = {
  minWidth: { xs: "100%", sm: 160 },
  width: { xs: "100%", sm: "auto" },
}

function when(value: string | Date | null | undefined) {
  return formatIstDateTime(value)
}

const DESK_TABS = [
  "today",
  "positions",
  "orders",
  "trades",
  "alerts",
  "signals",
  "lists",
  "decisions",
  "activity",
  "sessions",
  "contracts",
  "broker",
  "risk",
] as const
type DeskTab = (typeof DESK_TABS)[number]

function deskTabFromQuery(value: string | string[] | undefined): DeskTab {
  const raw = Array.isArray(value) ? value[0] : value
  return DESK_TABS.includes(raw as DeskTab) ? (raw as DeskTab) : "positions"
}

export default function DeskPage() {
  const { user } = useUser({ redirectTo: "/" })
  const router = useRouter()
  const tab = deskTabFromQuery(router.query.tab)
  useEffect(() => {
    if (router.query.tab === "plan") router.replace("/plan")
  }, [router.query.tab, router.replace])
  const setTab = (next: DeskTab) => {
    router.replace({ pathname: "/desk", query: { ...router.query, tab: next } }, undefined, {
      shallow: true,
    })
  }
  const [reconciling, setReconciling] = useState(false)
  const [reconMsg, setReconMsg] = useState<string | null>(null)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [phantomClear, setPhantomClear] = useState<{
    id: string
    symbol: string
    qty: number
    book: string
  } | null>(null)
  const [flattenRow, setFlattenRow] = useState<{
    id: string
    symbol: string
    qty: number
    book: string
    strategy: string
  } | null>(null)
  const [riskBusy, setRiskBusy] = useState(false)
  const [tradeBook, setTradeBook] = useState<"ALL" | "PAPER" | "LIVE">("ALL")
  const [positionView, setPositionView] = useState<PositionView>("LIVE")
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>("today")
  const [historyFrom, setHistoryFrom] = useState("")
  const [historyTo, setHistoryTo] = useState("")
  const [signalStrategy, setSignalStrategy] = useState("")
  const [signalInstrument, setSignalInstrument] = useState("")
  const [signalPlan, setSignalPlan] = useState("")
  const [signalJob, setSignalJob] = useState("")
  const [paperClearOpen, setPaperClearOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState<{
    feed: "alerts" | "signals"
    mode: FeedClearMode
  } | null>(null)

  const historyWindow = historyRange(historyPreset, { from: historyFrom, to: historyTo })
  const historyQuery = new URLSearchParams()
  if (tradeBook !== "ALL") historyQuery.set("book", tradeBook)
  if (historyWindow.from) historyQuery.set("from", historyWindow.from)
  if (historyWindow.to) historyQuery.set("to", historyWindow.to)
  if (historyPreset === "all") historyQuery.set("unbounded", "1")
  const historyQs = historyQuery.toString()
  const { data: portfolioData, mutate: mutatePortfolio } = useSWR(
    user?.isLoggedIn ? `/api/desk/portfolio${historyQs ? `?${historyQs}` : ""}` : null
  )
  const { data: positionData, mutate: mutatePositions } = useSWR(
    user?.isLoggedIn ? `/api/desk/positions?view=${positionView}` : null
  )
  const { data: orderData, mutate: mutateOrders } = useSWR(
    user?.isLoggedIn ? `/api/desk/orders${historyQs ? `?${historyQs}` : ""}` : null
  )
  const { data: tradeData, mutate: mutateTrades } = useSWR(
    user?.isLoggedIn ? `/api/desk/trades${historyQs ? `?${historyQs}` : ""}` : null
  )
  const { data: activityData, mutate: mutateActivity } = useSWR(
    user?.isLoggedIn ? `/api/desk/activity${historyQs ? `?${historyQs}` : ""}` : null
  )
  const alertQs = new URLSearchParams(historyQuery)
  const signalQs = new URLSearchParams(historyQuery)
  if (signalStrategy) signalQs.set("strategy", signalStrategy)
  if (signalInstrument) signalQs.set("instrument", signalInstrument)
  if (signalPlan) signalQs.set("planRef", signalPlan)
  if (signalJob) signalQs.set("jobId", signalJob)
  const { data: alertsData, mutate: mutateAlerts } = useSWR(
    user?.isLoggedIn ? `/api/desk/alerts?${alertQs}` : null
  )
  const { data: signalsData, mutate: mutateSignals } = useSWR(
    user?.isLoggedIn ? `/api/desk/signals?${signalQs}` : null
  )
  const { data: riskData, mutate: mutateRisk } = useSWR(user?.isLoggedIn ? "/api/desk/risk" : null)
  const { data: instrumentData } = useSWR(
    user?.isLoggedIn && tab === "contracts" ? "/api/desk/instruments" : null
  )

  if (!user?.isLoggedIn) {
    return <Layout title="Desk" loading />
  }

  const p = portfolioData?.portfolio
  const todayRows = portfolioData?.today ?? []
  const realizedRows = groupStrategyRealized(p?.strategyPnl ?? [])
  const todayOpen = todayRows.reduce((count, row) => count + row.open, 0)
  const sessions = portfolioData?.sessions ?? []
  const positions = positionData?.positions ?? []
  const orders = orderData?.orders ?? []
  const trades = tradeData?.trades ?? []
  const audit = activityData?.audit ?? []
  const decisions = activityData?.decisions ?? []
  const recon = activityData?.recon ?? []
  const alerts = alertsData?.alerts ?? []
  const alertErrors = Number(alertsData?.errorCount ?? 0)
  const alertWarns = Number(alertsData?.warnCount ?? 0)
  const signals = signalsData?.signals ?? []
  const signalFilters = signalsData?.filters ?? {
    strategies: [],
    instruments: [],
    planRefs: [],
    jobs: [],
  }
  const risk = riskData?.settings
  const deskHalted = Boolean(risk?.deskHalted)

  return (
    <Layout title="Desk" maxWidth="xl">
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" } }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Desk</Typography>
          <Typography color="text.secondary">
            Ledger view of orders, positions, round-trips, and why they happened. Kite remains live
            execution reality; this page is the application record.{" "}
            <Link href="/help/desk#risk-flags">Risk flags</Link>
          </Typography>
        </Box>
        {deskHalted ? (
          <Tooltip title="Clears the desk halt and turns Trading enabled back on. New entries can open again. Per-strategy halt is a separate checkbox on Risk.">
            <span>
              <Button
                color="warning"
                variant="contained"
                disabled={riskBusy}
                onClick={() => setResumeOpen(true)}
                sx={{ width: { xs: "100%", md: "auto" } }}
              >
                Resume trading
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Stops new entries desk-wide (same idea as turning off Trading enabled, with a stored reason). Flatten and stop-loss still work.">
            <span>
              <Button
                color="error"
                variant="outlined"
                disabled={riskBusy}
                onClick={async () => {
                  setRiskBusy(true)
                  try {
                    await fetchJson("/api/desk/risk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "halt", reason: "Manual halt from desk" }),
                    })
                    await mutateRisk()
                  } catch (e) {
                    setReconMsg(e instanceof Error ? e.message : "Halt failed")
                  } finally {
                    setRiskBusy(false)
                  }
                }}
                sx={{ width: { xs: "100%", md: "auto" } }}
              >
                Halt new entries
              </Button>
            </span>
          </Tooltip>
        )}
      </Stack>
      {reconMsg ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setReconMsg(null)}>
          {reconMsg}
        </Alert>
      ) : null}
      <ConfirmDialog
        open={Boolean(clearOpen)}
        title={clearOpen?.feed === "signals" ? "Clear persisted signals?" : "Hide notifications?"}
        message={
          clearOpen?.feed === "signals"
            ? clearOpen.mode === "all"
              ? "Deletes every stored signal. New evaluations after this still appear."
              : clearOpen.mode === "today"
                ? "Deletes today’s IST signal rows. Later evaluations still appear."
                : "Deletes signal rows from before today’s IST midnight."
            : clearOpen?.mode === "all"
              ? "Hides every notification until now. Ledger, jobs, and orders stay. New alerts still appear."
              : clearOpen?.mode === "today"
                ? "Hides today’s notifications up to now. New alerts still appear."
                : "Hides notifications from before today’s IST midnight."
        }
        confirmLabel="Clear"
        confirmColor="warning"
        onCancel={() => setClearOpen(null)}
        onConfirm={async () => {
          if (!clearOpen) return
          const path = clearOpen.feed === "signals" ? "/api/desk/signals" : "/api/desk/alerts"
          try {
            await fetchJson(path, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ period: clearOpen.mode }),
            })
            if (clearOpen.feed === "signals") await mutateSignals()
            else await mutateAlerts()
          } catch (e) {
            setReconMsg(e instanceof Error ? e.message : "Clear failed")
          } finally {
            setClearOpen(null)
          }
        }}
      />
      <ConfirmDialog
        open={paperClearOpen}
        title="Clear the paper book?"
        message="Removes paper and mock orders, fills, trades, decisions, flat paper positions, and the activity tied to them. Live and reconciled rows stay. Realized profit that a live position still carries from an earlier paper cycle is removed. Square off any open paper position and cancel working paper orders first. The broker is not contacted."
        confirmLabel="Clear paper book"
        confirmColor="warning"
        onCancel={() => setPaperClearOpen(false)}
        onConfirm={async () => {
          setPaperClearOpen(false)
          try {
            const result = await fetchJson<{ counts: Record<string, number> }>(
              "/api/desk/positions",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "clear-paper", confirm: "CLEAR PAPER" }),
              }
            )
            const c = result.counts
            setReconMsg(
              `Cleared paper book: ${c.orders ?? 0} orders, ${c.trades ?? 0} trades, ${c.positionsReset ?? 0} live rows reset`
            )
            await Promise.all([
              mutatePositions(),
              mutatePortfolio(),
              mutateOrders(),
              mutateTrades(),
              mutateActivity(),
            ])
          } catch (e) {
            setReconMsg(e instanceof Error ? e.message : "Clear paper book failed")
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(flattenRow)}
        title="Square off this position?"
        message={
          flattenRow
            ? `This sends a flatten for ${flattenRow.symbol} qty ${flattenRow.qty} (${flattenRow.book}${flattenRow.strategy ? ` · ${flattenRow.strategy}` : ""}). Chase can still take the next signal. The desk is not halted. A live book is refused while the market is closed. The position and its stop stay. Use Clear phantom only if the broker is already flat and the ledger is leftover.`
            : ""
        }
        confirmLabel="Square off"
        confirmColor="warning"
        onCancel={() => setFlattenRow(null)}
        onConfirm={async () => {
          if (!flattenRow) return
          try {
            const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ positionId: flattenRow.id }),
            })
            const notice = flattenOperatorNotice(result, `Squared off ${flattenRow.symbol}`)
            setReconMsg(notice.text)
            await mutatePositions()
            await mutatePortfolio()
          } catch (e) {
            setReconMsg(e instanceof Error ? e.message : "Square off failed")
          } finally {
            setFlattenRow(null)
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(phantomClear)}
        title="Clear phantom ledger row?"
        message={
          phantomClear
            ? `This zeros ${phantomClear.symbol} qty ${phantomClear.qty} (${phantomClear.book}) in the app ledger. It does not send a Kite order. Use it when the book is leftover paper or a phantom live row. If Kite still has size, flatten or Kill first.`
            : ""
        }
        confirmLabel="Clear phantom"
        confirmColor="warning"
        onCancel={() => setPhantomClear(null)}
        onConfirm={async () => {
          if (!phantomClear) return
          try {
            await fetchJson("/api/desk/positions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "clear-phantom",
                positionId: phantomClear.id,
                confirm: "CLEAR",
              }),
            })
            setReconMsg(`Cleared phantom ${phantomClear.symbol}`)
            await mutatePositions()
            await mutatePortfolio()
          } catch (e) {
            setReconMsg(e instanceof Error ? e.message : "Clear phantom failed")
          } finally {
            setPhantomClear(null)
          }
        }}
      />
      <ConfirmDialog
        open={resumeOpen}
        title="Resume trading?"
        message="This clears the desk halt and allows new entries again. Flatten and stop-loss orders were still allowed while halted. Resume only after you have reviewed positions."
        confirmLabel="Resume"
        confirmColor="warning"
        onCancel={() => setResumeOpen(false)}
        onConfirm={async () => {
          setResumeOpen(false)
          setRiskBusy(true)
          try {
            await fetchJson("/api/desk/risk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "resume" }),
            })
            await mutateRisk()
          } catch (e) {
            setReconMsg(e instanceof Error ? e.message : "Resume failed")
          } finally {
            setRiskBusy(false)
          }
        }}
      />

      <Box
        sx={{
          position: "sticky",
          top: { xs: 56, sm: 64 },
          zIndex: theme => theme.zIndex.appBar - 1,
          bgcolor: "background.default",
          pb: 1,
          mb: 1,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
          <Box
            component="button"
            type="button"
            onClick={() => setTab("risk")}
            title={
              deskHalted ? risk?.haltReason || "New entries are stopped" : "New entries allowed"
            }
            aria-label={
              deskHalted ? "Halted. New entries are stopped." : "Armed. New entries allowed."
            }
            sx={{
              font: "inherit",
              color: deskHalted ? "error.main" : "success.main",
              border: 1,
              borderColor: deskHalted ? "error.main" : "success.main",
              bgcolor: "background.paper",
              borderRadius: 1,
              px: 1,
              py: 0.25,
              cursor: "pointer",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {deskHalted ? "Halted" : "Armed"}
            </Typography>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => setTab("alerts")}
            aria-label={
              alertErrors + alertWarns
                ? `${alertErrors + alertWarns} open alerts`
                : "No open alerts"
            }
            sx={{
              font: "inherit",
              color: alertErrors ? "error.main" : alertWarns ? "warning.main" : "text.secondary",
              border: 1,
              borderColor: alertErrors ? "error.main" : alertWarns ? "warning.main" : "divider",
              bgcolor: "background.paper",
              borderRadius: 1,
              px: 1,
              py: 0.25,
              cursor: "pointer",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {alertErrors + alertWarns ? `Alerts ${alertErrors + alertWarns}` : "Alerts"}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.9fr 1.1fr" },
            gap: 1,
            mb: 1,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setTab("sessions")}
            title="Closed is round-trips finished today. Mark is from the entry price, so an overnight Chase book includes earlier days."
            aria-label="Today by strategy. The number in parentheses is open books. Closed is round-trips finished today. Open mark is from the entry price."
            sx={deskTileSx}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                columnGap: 1,
                alignItems: "baseline",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Today · {todayOpen} open
              </Typography>
              <Typography variant="caption" color="text.secondary">
                closed
              </Typography>
              <Typography variant="caption" color="text.secondary">
                mark
              </Typography>
              {todayRows.map(row => (
                <Box key={row.id} sx={{ display: "contents" }}>
                  <Typography variant="body2" noWrap>
                    {row.label} ({row.open})
                  </Typography>
                  <Figure kind="inr" value={row.closedToday} pnl align="left" />
                  <Figure kind="inr" value={row.openMark} pnl align="left" />
                </Box>
              ))}
            </Box>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => setTab("positions")}
            title="Realized already stored on the books. It is not today's closed column, and it is not Kite's day P&L."
            aria-label="Realized on the books by strategy. This is not today's closed round-trips."
            sx={deskTileSx}
          >
            <Typography variant="caption" color="text.secondary">
              Realized
            </Typography>
            {realizedRows.map(row => (
              <Box
                key={row.id}
                sx={{ display: "flex", justifyContent: "space-between", gap: 1, minWidth: 0 }}
              >
                <Typography variant="body2" noWrap>
                  {row.label}
                </Typography>
                <Figure kind="inr" value={row.realized} pnl align="right" />
              </Box>
            ))}
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => setTab("positions")}
            aria-label={`Cash ${formatInr(p?.availableCash)}. Realized ${formatInr(p?.realizedPnl)}. Unrealized ${formatInr(p?.unrealizedPnl)}. Portfolio ${formatInr(p?.portfolioValue)}. Gross exposure ${formatInr(p?.grossExposure)}. Drawdown ${formatInr(p?.drawdown)}.`}
            sx={{
              ...deskTileSx,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 1.5,
              rowGap: 0.25,
            }}
          >
            {(
              [
                ["Cash", formatInr(p?.availableCash)],
                ["Portfolio", formatInr(p?.portfolioValue)],
                ["Realized", formatInr(p?.realizedPnl)],
                ["Gross exposure", formatInr(p?.grossExposure)],
                ["Unrealized", formatInr(p?.unrealizedPnl)],
                ["Drawdown", formatInr(p?.drawdown)],
              ] as const
            ).map(([label, value]) => (
              <Box
                key={label}
                sx={{ display: "flex", justifyContent: "space-between", gap: 0.5, minWidth: 0 }}
              >
                <Typography variant="caption" color="text.secondary" noWrap>
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Paper>
          <Tabs
            value={DESK_TABS.indexOf(tab)}
            onChange={(_, v) => setTab(DESK_TABS[v] ?? "positions")}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label="Today" />
            <Tab label="Positions" />
            <Tab label="Orders" />
            <Tab label="Trades" />
            <Tab
              label={
                alertErrors + alertWarns > 0 ? `Alerts (${alertErrors + alertWarns})` : "Alerts"
              }
            />
            <Tab label={signals.length ? `Signals (${signals.length})` : "Signals"} />
            <Tab label="Lists" />
            <Tab label="Decisions" />
            <Tab label="Activity" />
            <Tab label="Sessions" />
            <Tab label="Contracts" />
            <Tab label="Broker" />
            <Tab label="Risk" />
          </Tabs>
        </Paper>
      </Box>

      {tab === "today" ? (
        <>
          <DueSchedules />
          <TradesForDay />
        </>
      ) : null}

      {tab === "positions" || tab === "orders" || tab === "trades" || tab === "decisions" ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.5 }}>
          {tab === "positions" ? (
            <FormControl size="small" sx={filterFieldSx}>
              <InputLabel>Show</InputLabel>
              <Select
                label="Show"
                value={positionView}
                onChange={e => setPositionView(e.target.value as PositionView)}
              >
                <MenuItem value="LIVE">Live only</MenuItem>
                <MenuItem value="WITH_RECON">All (Live + reconciled)</MenuItem>
                <MenuItem value="PAPER">Paper / mock</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <FormControl size="small" sx={filterFieldSx}>
              <InputLabel>Book</InputLabel>
              <Select
                label="Book"
                value={tradeBook}
                onChange={e => setTradeBook(e.target.value as typeof tradeBook)}
              >
                <MenuItem value="ALL">All books</MenuItem>
                <MenuItem value="PAPER">Paper / mock</MenuItem>
                <MenuItem value="LIVE">Live / recon</MenuItem>
              </Select>
            </FormControl>
          )}
          <Button
            size="small"
            color="warning"
            variant="outlined"
            onClick={() => setPaperClearOpen(true)}
          >
            Clear paper book
          </Button>
          {tab !== "positions" ? (
            <HistoryPeriod
              preset={historyPreset}
              from={historyFrom}
              to={historyTo}
              onPreset={setHistoryPreset}
              onFrom={setHistoryFrom}
              onTo={setHistoryTo}
            />
          ) : null}
        </Stack>
      ) : null}

      {tab === "positions" ? (
        <Paper sx={{ overflow: "hidden" }}>
          <ScrollTable minWidth={880}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell>Book</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Avg</TableCell>
                  <TableCell align="right">Mark</TableCell>
                  <TableCell align="right">Unrealized</TableCell>
                  <TableCell align="right">Realized</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((row: Record<string, unknown>) => {
                  const qty = Number(row.quantity)
                  const flat = Number.isFinite(qty) && qty === 0
                  return (
                    <TableRow key={String(row.id)}>
                      <TableCell>{String(row.tradingsymbol)}</TableCell>
                      <TableCell>{String(row.product || "—")}</TableCell>
                      <TableCell>{String(row.strategy || "—")}</TableCell>
                      <TableCell>{String(row.provenance || "—")}</TableCell>
                      <TableCell align="right">{String(row.quantity)}</TableCell>
                      <TableCell align="right">
                        <Figure
                          kind="price"
                          value={row.averageEntryPrice as string}
                          flat={flat}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Figure kind="price" value={row.markPrice as string} />
                      </TableCell>
                      <TableCell align="right">
                        <Figure
                          kind="inr"
                          value={flat ? "0" : (row.unrealizedPnl as string)}
                          pnl
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Figure kind="inr" value={row.realizedPnl as string} pnl />
                      </TableCell>
                      <TableCell>{flat ? "FLAT" : String(row.status)}</TableCell>
                      <TableCell>
                        {Number(row.quantity) !== 0 && row.status === "OPEN" ? (
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}
                          >
                            <Button
                              size="small"
                              color="warning"
                              variant="outlined"
                              onClick={() =>
                                setFlattenRow({
                                  id: String(row.id),
                                  symbol: String(row.tradingsymbol),
                                  qty: Number(row.quantity),
                                  book: String(row.provenance || "—"),
                                  strategy: String(row.strategy || ""),
                                })
                              }
                            >
                              Square off
                            </Button>
                            <Button
                              size="small"
                              color="warning"
                              onClick={() =>
                                setPhantomClear({
                                  id: String(row.id),
                                  symbol: String(row.tradingsymbol),
                                  qty: Number(row.quantity),
                                  book: String(row.provenance || "—"),
                                })
                              }
                            >
                              Clear phantom
                            </Button>
                          </Stack>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
          {positions.length === 0 ? (
            <Typography sx={{ p: 2 }} color="text.secondary">
              No positions in the ledger yet. Punch a trade or run Reconcile. Square off sends a
              flatten for an open book. Clear phantom zeros a leftover ledger row and does not send
              a Kite order.
            </Typography>
          ) : (
            <Typography sx={{ p: 2 }} color="text.secondary" variant="body2">
              Square off flattens the open book (paper or live) without halting the desk. Clear
              phantom zeros a leftover ledger row after proving Kite is flat (paper rows skip Kite).
              It does not flatten the broker. Reconcile if Kite has size the ledger missed.
            </Typography>
          )}
        </Paper>
      ) : null}

      {tab === "orders" ? (
        <Paper sx={{ overflow: "hidden" }}>
          <ScrollTable minWidth={880}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Filled</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Side</TableCell>
                  <TableCell>Symbol</TableCell>
                  <TableCell align="right">Filled / Qty</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Purpose</TableCell>
                  <TableCell>Book</TableCell>
                  <TableCell>Tag</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Broker id</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((row: Record<string, unknown>) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{when(row.createdAt as string)}</TableCell>
                    <TableCell>{when(row.filledAt as string)}</TableCell>
                    <TableCell>{String(row.status)}</TableCell>
                    <TableCell>{String(row.side)}</TableCell>
                    <TableCell>{String(row.tradingsymbol)}</TableCell>
                    <TableCell align="right">
                      {String(row.filledQty)} / {String(row.requestedQty)}
                    </TableCell>
                    <TableCell>{orderPriceLabel(row)}</TableCell>
                    <TableCell>{String(row.orderType || "—")}</TableCell>
                    <TableCell>{String(row.purpose)}</TableCell>
                    <TableCell>{String(row.provenance || "—")}</TableCell>
                    <TableCell>{String(row.orderTag || "—")}</TableCell>
                    <TableCell>{String(row.rejectReason || row.errorInfo || "—")}</TableCell>
                    <TableCell>{String(row.brokerOrderId || "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
          {orders.length === 0 ? (
            <Typography sx={{ p: 2 }} color="text.secondary">
              No ledger orders in this book. A job that never punched (Sunday, risk block, enqueue
              fail) is not an order — see Alerts.
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      {tab === "trades" ? (
        <Paper sx={{ overflow: "hidden" }}>
          <ScrollTable minWidth={800}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entry</TableCell>
                  <TableCell>Exit</TableCell>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Dir</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell>Book</TableCell>
                  <TableCell align="right">Entry / Exit qty</TableCell>
                  <TableCell align="right">Avg in / out</TableCell>
                  <TableCell align="right">Net P&L</TableCell>
                  <TableCell>Exit reason</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trades.map((row: Record<string, unknown>) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{when(row.entryAt as string)}</TableCell>
                    <TableCell>{when(row.exitAt as string)}</TableCell>
                    <TableCell>{String(row.tradingsymbol)}</TableCell>
                    <TableCell>{String(row.direction)}</TableCell>
                    <TableCell>{String(row.strategy || "—")}</TableCell>
                    <TableCell>{String(row.provenance || "—")}</TableCell>
                    <TableCell align="right">
                      {String(row.entryQty)} / {String(row.exitQty)}
                    </TableCell>
                    <TableCell align="right">
                      {formatInr(row.averageEntry as string)} / {formatInr(row.averageExit as string)}
                    </TableCell>
                    <TableCell align="right">{formatInr(row.netPnl as string)}</TableCell>
                    <TableCell>{String(row.exitReason || "—")}</TableCell>
                    <TableCell>{String(row.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        </Paper>
      ) : null}

      {tab === "alerts" ? (
        <AlertsPanel
          alerts={alerts}
          errorCount={alertErrors}
          warnCount={alertWarns}
          preset={historyPreset}
          from={historyFrom}
          to={historyTo}
          onPreset={setHistoryPreset}
          onFrom={setHistoryFrom}
          onTo={setHistoryTo}
          onClear={mode => setClearOpen({ feed: "alerts", mode })}
        />
      ) : null}

      {tab === "lists" ? <IndexLists /> : null}

      {tab === "signals" ? (
        <SignalsPanel
          signals={signals}
          filters={signalFilters}
          preset={historyPreset}
          from={historyFrom}
          to={historyTo}
          strategy={signalStrategy}
          instrument={signalInstrument}
          planRef={signalPlan}
          jobId={signalJob}
          onPreset={setHistoryPreset}
          onFrom={setHistoryFrom}
          onTo={setHistoryTo}
          onStrategy={setSignalStrategy}
          onInstrument={setSignalInstrument}
          onPlanRef={setSignalPlan}
          onJobId={setSignalJob}
          onClear={mode => setClearOpen({ feed: "signals", mode })}
        />
      ) : null}

      {tab === "decisions" ? (
        <Paper sx={{ overflow: "hidden" }}>
          <ScrollTable minWidth={720}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Book</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {decisions.map((row: Record<string, unknown>) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{when(row.occurredAt as string)}</TableCell>
                    <TableCell>{String(row.action)}</TableCell>
                    <TableCell>{String(row.strategy || "—")}</TableCell>
                    <TableCell>{String(row.tradingsymbol || row.instrument || "—")}</TableCell>
                    <TableCell>{String(row.provenance || "—")}</TableCell>
                    <TableCell>{String(row.riskResult || "—")}</TableCell>
                    <TableCell>{String(row.reason || row.intent || "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        </Paper>
      ) : null}

      {tab === "activity" ? (
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <HistoryPeriod
              preset={historyPreset}
              from={historyFrom}
              to={historyTo}
              onPreset={setHistoryPreset}
              onFrom={setHistoryFrom}
              onTo={setHistoryTo}
            />
          </Stack>
          <Paper sx={{ overflow: "hidden" }}>
            <Typography variant="subtitle2" sx={{ p: 1.5 }}>
              Audit
            </Typography>
            <ScrollTable minWidth={560}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Instrument</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Summary</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {audit.map((row: Record<string, unknown>) => (
                    <TableRow key={String(row.id)}>
                      <TableCell>{when(row.occurredAt as string)}</TableCell>
                      <TableCell>{String(row.eventType)}</TableCell>
                      <TableCell>{String(row.instrument || "—")}</TableCell>
                      <TableCell>{String(row.actor)}</TableCell>
                      <TableCell>{String(row.summary || "—")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollTable>
          </Paper>
          <Paper sx={{ overflow: "hidden" }}>
            <Typography variant="subtitle2" sx={{ p: 1.5 }}>
              Reconciliation
            </Typography>
            <ScrollTable minWidth={640}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Detail</TableCell>
                    <TableCell>Resolved</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recon.map((row: Record<string, unknown>) => (
                    <TableRow key={String(row.id)}>
                      <TableCell>{when(row.occurredAt as string)}</TableCell>
                      <TableCell>{String(row.kind)}</TableCell>
                      <TableCell>{String(row.tradingsymbol || "—")}</TableCell>
                      <TableCell>{String(row.detail || "—")}</TableCell>
                      <TableCell>{row.resolved ? "yes" : "no"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollTable>
          </Paper>
        </Stack>
      ) : null}

      {tab === "sessions" ? (
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <HistoryPeriod
              preset={historyPreset}
              from={historyFrom}
              to={historyTo}
              onPreset={setHistoryPreset}
              onFrom={setHistoryFrom}
              onTo={setHistoryTo}
            />
          </Stack>
          <Paper sx={{ overflow: "hidden" }}>
            <ScrollTable minWidth={560}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date (IST)</TableCell>
                    <TableCell align="right">Net P&L</TableCell>
                    <TableCell align="right">Fees</TableCell>
                    <TableCell align="right">Trades</TableCell>
                    <TableCell align="right">Wins</TableCell>
                    <TableCell align="right">Win rate</TableCell>
                    <TableCell align="right">Drawdown</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((row: Record<string, unknown>) => (
                    <TableRow key={String(row.sessionDate)}>
                      <TableCell>{String(row.sessionDate)}</TableCell>
                      <TableCell align="right">
                        <Figure kind="inr" value={row.netPnl as string} pnl />
                      </TableCell>
                      <TableCell align="right">{formatInr(row.fees as string)}</TableCell>
                      <TableCell align="right">{String(row.tradeCount)}</TableCell>
                      <TableCell align="right">{String(row.winCount)}</TableCell>
                      <TableCell align="right">
                        <Figure kind="pct" value={row.winRate as string} />
                      </TableCell>
                      <TableCell align="right">{formatInr(row.maxDrawdown as string)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollTable>
          </Paper>
        </Stack>
      ) : null}

      {tab === "contracts" ? <ContractsPanel data={instrumentData} /> : null}

      {tab === "broker" ? (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Reconcile with broker</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Pulls Kite orders into the ledger and applies fills the desk already knows. This
              covers every strategy. A new order is tagged Chase only when its Kite tag is chase.
              Quantity gaps are recorded and are not assigned to a strategy here.
            </Typography>
            <Button
              variant="outlined"
              disabled={reconciling}
              onClick={async () => {
                setReconciling(true)
                setReconMsg(null)
                try {
                  const result = await fetchJson<{
                    appliedFills: number
                    brokerOrdersSeen: number
                    mismatches: number
                  }>("/api/desk/reconcile", { method: "POST" })
                  setReconMsg(
                    `Reconciled: ${result.appliedFills} fills applied, ${result.brokerOrdersSeen} broker orders, ${result.mismatches} mismatches`
                  )
                  await mutatePortfolio()
                } catch (e) {
                  setReconMsg(e instanceof Error ? e.message : "Reconcile failed")
                } finally {
                  setReconciling(false)
                }
              }}
            >
              {reconciling ? "Reconciling…" : "Reconcile with broker"}
            </Button>
          </Paper>
          <StrategyReconcile
            onChanged={async () => {
              await Promise.all([
                mutatePortfolio(),
                mutatePositions(),
                mutateOrders(),
                mutateTrades(),
              ])
            }}
          />
        </Stack>
      ) : null}

      {tab === "risk" ? (
        <Paper>
          <RiskControls
            settings={risk ?? DEFAULT_RISK_SETTINGS}
            mockOrders={Boolean(riskData?.mockOrders)}
            setups={riskData?.setups}
            onSaved={() => mutateRisk()}
          />
        </Paper>
      ) : null}
    </Layout>
  )
}

export { getServerSideProps } from "../lib/ssrPage"
