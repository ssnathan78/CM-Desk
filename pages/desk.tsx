import { Alert, Box } from "@mui/material"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import DeskViewChrome from "../components/desk/DeskViewChrome"
import PositionRowActions from "../components/desk/PositionRowActions"
import {
  auditColumns,
  decisionColumns,
  mapPositionRow,
  mapSessionRow,
  mapTradeRow,
  orderColumns,
  positionColumns,
  reconColumns,
  sessionColumns,
  sortPositions,
  tradeColumns,
} from "../components/desk/tables/buildDeskColumns"
import BooksView from "../components/desk/views/BooksView"
import DeskSummaryTiles from "../components/desk/views/DeskSummaryTiles"
import NowView from "../components/desk/views/NowView"
import SetupView from "../components/desk/views/SetupView"
import WhyView from "../components/desk/views/WhyView"
import Layout from "../components/Layout"
import ConfirmAction from "../components/lib/ConfirmAction"
import { tradesDrillQuery } from "../lib/desk/sessionDrill"
import {
  type DeskTab,
  type DeskView,
  defaultTabForView,
  parseDeskRoute,
  viewForTab,
} from "../lib/deskNavigation"
import fetchJson from "../lib/fetchJson"
import { type FlattenOpenResult, flattenOperatorNotice } from "../lib/flattenNotice"
import { formatIstDateTime } from "../lib/format"
import { type ActionOutcome, chaseSquareOffCopy } from "../lib/operatorActionCopy"
import { SQUARE_OFF_CONFIRM } from "../lib/operatorConfirm"
import type { FeedClearMode } from "../lib/trading/feedWindow"
import { type HistoryPreset, historyRange } from "../lib/trading/historyRange"
import { groupStrategyRealized } from "../lib/trading/todayGroups"
import type { PositionView } from "../lib/trading/types"
import useUser from "../lib/useUser"

function when(value: string | Date | null | undefined) {
  return formatIstDateTime(value)
}

export default function DeskPage() {
  const { user } = useUser({ redirectTo: "/" })
  const router = useRouter()
  const { view, tab } = parseDeskRoute(router.query)
  useEffect(() => {
    if (!router.isReady) return
    if (router.query.tab === "plan") router.replace("/plan")
    if (router.query.tab === "risk") {
      router.replace("/risk")
      return
    }
    const parsed = parseDeskRoute(router.query)
    const hasView = typeof router.query.view === "string"
    if (!hasView) {
      router.replace(
        { pathname: "/desk", query: { view: parsed.view, tab: parsed.tab } },
        undefined,
        { shallow: true }
      )
    }
  }, [router.isReady, router.query, router.replace])

  useEffect(() => {
    if (!router.isReady) return
    const jid = router.query.jobId
    if (typeof jid === "string") setSignalJob(jid)
    const strat = router.query.strategy
    if (typeof strat === "string") setSignalStrategy(strat)
  }, [router.isReady, router.query.jobId, router.query.strategy])

  useEffect(() => {
    if (!router.isReady) return
    const from = router.query.from
    const to = router.query.to
    if (typeof from === "string") {
      setHistoryFrom(from)
      setHistoryPreset("custom")
    }
    if (typeof to === "string") {
      setHistoryTo(to)
      setHistoryPreset("custom")
    }
  }, [router.isReady, router.query.from, router.query.to])

  const setDeskRoute = (nextView: DeskView, nextTab: DeskTab) => {
    router.replace({ pathname: "/desk", query: { view: nextView, tab: nextTab } }, undefined, {
      shallow: true,
    })
  }
  const setTab = (next: DeskTab) => setDeskRoute(viewForTab(next), next)
  const setView = (nextView: DeskView) => setDeskRoute(nextView, defaultTabForView(nextView))
  const [reconciling, setReconciling] = useState(false)
  const [reconMsg, setReconMsg] = useState<{
    text: string
    severity: "success" | "error"
  } | null>(null)
  const [actionOutcome, setActionOutcome] = useState<ActionOutcome | null>(null)
  const [chaseFlatten, setChaseFlatten] = useState<string | null>(null)
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
  const [positionDetail, setPositionDetail] = useState<ReturnType<typeof mapPositionRow> | null>(
    null
  )

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
  const { data: instrumentData } = useSWR(
    user?.isLoggedIn && view === "setup" && tab === "contracts" ? "/api/desk/instruments" : null
  )

  const positionsFromApi = positionData?.positions ?? []
  const sessionsFromApi = portfolioData?.sessions ?? []
  const positionRows = useMemo(
    () => sortPositions(positionsFromApi.map(row => mapPositionRow(row))),
    [positionsFromApi]
  )
  const positionCols = useMemo(
    () =>
      positionColumns(row =>
        Number(row.quantity) !== 0 && row.status === "OPEN" ? (
          <PositionRowActions
            symbol={row.tradingsymbol}
            qty={Number(row.quantity)}
            onSquareOff={() => {
              setActionOutcome(null)
              setFlattenRow({
                id: row.id,
                symbol: row.tradingsymbol,
                qty: Number(row.quantity),
                book: String(row.provenance || "—"),
                strategy: String(row.strategy || ""),
              })
            }}
            onClearPhantom={() => {
              setActionOutcome(null)
              setPhantomClear({
                id: row.id,
                symbol: row.tradingsymbol,
                qty: Number(row.quantity),
                book: String(row.provenance || "—"),
              })
            }}
          />
        ) : null
      ),
    []
  )
  const orderCols = useMemo(() => orderColumns(when), [])
  const tradeCols = useMemo(() => tradeColumns(when), [])
  const sessionCols = useMemo(() => sessionColumns(), [])
  const decisionCols = useMemo(() => decisionColumns(when), [])
  const auditCols = useMemo(() => auditColumns(when), [])
  const reconCols = useMemo(() => reconColumns(when), [])
  const sessionRows = useMemo(
    () => sessionsFromApi.map(row => mapSessionRow(row)),
    [sessionsFromApi]
  )
  const tradesFromApi = tradeData?.trades ?? []
  const tradeRows = useMemo(() => tradesFromApi.map(row => mapTradeRow(row)), [tradesFromApi])

  if (!user?.isLoggedIn) {
    return <Layout title="Desk" loading />
  }

  const p = portfolioData?.portfolio
  const todayRows = portfolioData?.today ?? []
  const realizedRows = groupStrategyRealized(p?.strategyPnl ?? [])
  const todayOpen = todayRows.reduce((count, row) => count + row.open, 0)
  const orders = orderData?.orders ?? []
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
  return (
    <Layout title="Desk" maxWidth="xl">
      {reconMsg ? (
        <Alert severity={reconMsg.severity} sx={{ mb: 2 }} onClose={() => setReconMsg(null)}>
          {reconMsg.text}
        </Alert>
      ) : null}
      <ConfirmAction
        open={Boolean(clearOpen)}
        tone="attention"
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
            setReconMsg({
              text: e instanceof Error ? e.message : "Clear failed",
              severity: "error",
            })
          } finally {
            setClearOpen(null)
          }
        }}
      />
      <ConfirmAction
        open={paperClearOpen}
        tone="attention"
        title="Clear the paper book?"
        message="Removes paper and mock orders, fills, trades, decisions, flat paper positions, and the activity tied to them. Live and reconciled rows stay. Realized profit that a live position still carries from an earlier paper cycle is removed. Square off any open paper position and cancel working paper orders first. The broker is not contacted."
        confirmLabel="Clear paper book"
        outcome={paperClearOpen ? actionOutcome : null}
        onCancel={() => {
          setPaperClearOpen(false)
          setActionOutcome(null)
        }}
        onConfirm={async () => {
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
            setActionOutcome({
              severity: "success",
              text: `Cleared paper book: ${c.orders ?? 0} orders, ${c.trades ?? 0} trades, ${c.positionsReset ?? 0} live rows reset. The broker was not contacted.`,
            })
            await Promise.all([
              mutatePositions(),
              mutatePortfolio(),
              mutateOrders(),
              mutateTrades(),
              mutateActivity(),
            ])
          } catch (e) {
            setActionOutcome({
              severity: "error",
              text: e instanceof Error ? e.message : "Clear paper book failed",
            })
          }
        }}
      />
      <ConfirmAction
        open={Boolean(flattenRow)}
        tone="attention"
        title="Square off this position?"
        message={
          flattenRow
            ? `This sends a flatten for ${flattenRow.symbol} qty ${flattenRow.qty} (${flattenRow.book}${flattenRow.strategy ? ` · ${flattenRow.strategy}` : ""}). Chase can still take the next signal. The desk is not halted. A live book is refused while the market is closed. The position and its stop stay. Use Clear phantom only if the broker is already flat and the ledger is leftover.`
            : ""
        }
        confirmLabel="Square off"
        outcome={flattenRow ? actionOutcome : null}
        onCancel={() => {
          setFlattenRow(null)
          setActionOutcome(null)
        }}
        onConfirm={async () => {
          if (!flattenRow) return
          try {
            const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ positionId: flattenRow.id, confirm: SQUARE_OFF_CONFIRM }),
            })
            const notice = flattenOperatorNotice(result, `Squared off ${flattenRow.symbol}`)
            setActionOutcome(notice)
            await mutatePositions()
            await mutatePortfolio()
          } catch (e) {
            setActionOutcome({
              severity: "error",
              text: e instanceof Error ? e.message : "Square off failed",
            })
          }
        }}
      />
      <ConfirmAction
        open={Boolean(phantomClear)}
        tone="attention"
        title="Clear phantom ledger row?"
        message={
          phantomClear
            ? `This zeros ${phantomClear.symbol} qty ${phantomClear.qty} (${phantomClear.book}) in the app ledger. It does not send a Kite order. Use it when the book is leftover paper or a phantom live row. If Kite still has size, flatten or Kill first.`
            : ""
        }
        confirmLabel="Clear phantom"
        outcome={phantomClear ? actionOutcome : null}
        onCancel={() => {
          setPhantomClear(null)
          setActionOutcome(null)
        }}
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
            setActionOutcome({
              severity: "success",
              text: `Cleared phantom ${phantomClear.symbol}. No Kite order was sent.`,
            })
            await mutatePositions()
            await mutatePortfolio()
          } catch (e) {
            setActionOutcome({
              severity: "error",
              text: e instanceof Error ? e.message : "Clear phantom failed",
            })
          }
        }}
      />
      <ConfirmAction
        open={Boolean(chaseFlatten)}
        tone="attention"
        title={chaseSquareOffCopy(chaseFlatten).title}
        message={chaseSquareOffCopy(chaseFlatten).message}
        confirmLabel="Square off"
        outcome={chaseFlatten ? actionOutcome : null}
        onCancel={() => {
          setChaseFlatten(null)
          setActionOutcome(null)
        }}
        onConfirm={async () => {
          if (!chaseFlatten) return
          try {
            const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                strategy: "CHASE",
                instrument: chaseFlatten,
                confirm: SQUARE_OFF_CONFIRM,
              }),
            })
            const notice = flattenOperatorNotice(
              result,
              `${chaseFlatten} squared off. Other Chase books stay.`
            )
            setActionOutcome(notice)
            await Promise.all([mutatePositions(), mutatePortfolio()])
          } catch (e) {
            setActionOutcome({
              severity: "error",
              text: e instanceof Error ? e.message : "Square off failed",
            })
          }
        }}
      />
      <DeskSummaryTiles
        todayRows={todayRows}
        todayOpen={todayOpen}
        realizedRows={realizedRows}
        portfolio={p}
        onNavigate={setDeskRoute}
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
        <DeskViewChrome
          view={view}
          tab={tab}
          alertBadge={alertErrors + alertWarns > 0 ? alertErrors + alertWarns : undefined}
          signalBadge={signals.length > 0 ? signals.length : undefined}
          onView={setView}
          onTab={next => setDeskRoute(view, next)}
        />
      </Box>

      {view === "now" && tab === "today" ? (
        <NowView
          todayRows={todayRows}
          realizedRows={realizedRows}
          portfolio={p}
          onChaseSquareOff={instrument => {
            setActionOutcome(null)
            setChaseFlatten(instrument)
          }}
          onEmergencyDone={async () => {
            await Promise.all([mutatePortfolio(), mutatePositions(), mutateOrders()])
          }}
        />
      ) : null}

      {view === "books" ? (
        <BooksView
          tab={tab}
          positionView={positionView}
          tradeBook={tradeBook}
          historyPreset={historyPreset}
          historyFrom={historyFrom}
          historyTo={historyTo}
          positionCols={positionCols}
          positionRows={positionRows}
          positionDetail={positionDetail}
          orderCols={orderCols}
          orders={orders as Record<string, unknown>[]}
          tradeCols={tradeCols}
          tradeRows={tradeRows}
          sessionCols={sessionCols}
          sessionRows={sessionRows}
          onPositionView={setPositionView}
          onTradeBook={setTradeBook}
          onHistoryPreset={setHistoryPreset}
          onHistoryFrom={setHistoryFrom}
          onHistoryTo={setHistoryTo}
          onClearPaper={() => {
            setActionOutcome(null)
            setPaperClearOpen(true)
          }}
          onPositionDetail={setPositionDetail}
          onSquareOffDetail={() => {
            if (!positionDetail) return
            setActionOutcome(null)
            setFlattenRow({
              id: positionDetail.id,
              symbol: positionDetail.tradingsymbol,
              qty: Number(positionDetail.quantity),
              book: String(positionDetail.provenance || "—"),
              strategy: String(positionDetail.strategy || ""),
            })
          }}
          onClearPhantomDetail={() => {
            if (!positionDetail) return
            setActionOutcome(null)
            setPhantomClear({
              id: positionDetail.id,
              symbol: positionDetail.tradingsymbol,
              qty: Number(positionDetail.quantity),
              book: String(positionDetail.provenance || "—"),
            })
          }}
          onSessionDrill={sessionDate => {
            router.push({ pathname: "/desk", query: tradesDrillQuery(sessionDate) })
          }}
        />
      ) : null}

      {view === "why" ? (
        <WhyView
          tab={tab}
          alerts={alerts}
          alertErrors={alertErrors}
          alertWarns={alertWarns}
          signals={signals}
          signalFilters={signalFilters}
          decisions={decisions}
          audit={audit}
          recon={recon}
          historyPreset={historyPreset}
          historyFrom={historyFrom}
          historyTo={historyTo}
          signalStrategy={signalStrategy}
          signalInstrument={signalInstrument}
          signalPlan={signalPlan}
          signalJob={signalJob}
          decisionCols={decisionCols}
          auditCols={auditCols}
          reconCols={reconCols}
          tradeBook={tradeBook}
          onTradeBook={setTradeBook}
          onClearPaper={() => {
            setActionOutcome(null)
            setPaperClearOpen(true)
          }}
          onHistoryPreset={setHistoryPreset}
          onHistoryFrom={setHistoryFrom}
          onHistoryTo={setHistoryTo}
          onSignalStrategy={setSignalStrategy}
          onSignalInstrument={setSignalInstrument}
          onSignalPlan={setSignalPlan}
          onSignalJob={setSignalJob}
          onClearFeed={(feed, mode) => setClearOpen({ feed, mode })}
        />
      ) : null}

      {view === "setup" ? (
        <SetupView
          tab={tab}
          instrumentData={instrumentData}
          reconciling={reconciling}
          onReconcile={async () => {
            setReconciling(true)
            setReconMsg(null)
            try {
              const result = await fetchJson<{
                appliedFills: number
                brokerOrdersSeen: number
                mismatches: number
              }>("/api/desk/reconcile", { method: "POST" })
              setReconMsg({
                text: `Reconciled: ${result.appliedFills} fills applied, ${result.brokerOrdersSeen} broker orders, ${result.mismatches} mismatches`,
                severity: "success",
              })
              await mutatePortfolio()
            } catch (e) {
              setReconMsg({
                text: e instanceof Error ? e.message : "Reconcile failed",
                severity: "error",
              })
            } finally {
              setReconciling(false)
            }
          }}
          onPaperClear={() => {
            setActionOutcome(null)
            setPaperClearOpen(true)
          }}
          onChaseResetDone={() => mutatePortfolio()}
          onReconcileChanged={async () => {
            await Promise.all([
              mutatePortfolio(),
              mutatePositions(),
              mutateOrders(),
              mutateTrades(),
            ])
          }}
        />
      ) : null}
    </Layout>
  )
}

export { getServerSideProps } from "../lib/ssrPage"
