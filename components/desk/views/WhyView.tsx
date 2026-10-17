import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material"
import type { ColumnDef } from "@tanstack/react-table"
import type { DeskTab } from "../../../lib/deskNavigation"
import type { OperatorAlert } from "../../../lib/trading/alerts"
import type { FeedClearMode } from "../../../lib/trading/feedWindow"
import type { HistoryPreset } from "../../../lib/trading/historyRange"
import type { SignalFilters, StrategySignal } from "../../../lib/trading/signals"
import PageSection from "../../lib/PageSection"
import RecordTable from "../../records/RecordTable"
import AlertsPanel from "../AlertsPanel"
import BooksToolbarMenu from "../BooksToolbarMenu"
import HistoryPeriod from "../HistoryPeriod"
import SignalsPanel from "../SignalsPanel"
import type { ActivityRow } from "../tables/buildDeskColumns"

export default function WhyView({
  tab,
  alerts,
  alertErrors,
  alertWarns,
  signals,
  signalFilters,
  decisions,
  audit,
  recon,
  historyPreset,
  historyFrom,
  historyTo,
  signalStrategy,
  signalInstrument,
  signalPlan,
  signalJob,
  decisionCols,
  auditCols,
  reconCols,
  tradeBook,
  onTradeBook,
  onClearPaper,
  onHistoryPreset,
  onHistoryFrom,
  onHistoryTo,
  onSignalStrategy,
  onSignalInstrument,
  onSignalPlan,
  onSignalJob,
  onClearFeed,
}: {
  tab: DeskTab
  alerts: OperatorAlert[]
  alertErrors: number
  alertWarns: number
  signals: StrategySignal[]
  signalFilters: SignalFilters
  decisions: ActivityRow[]
  audit: ActivityRow[]
  recon: ActivityRow[]
  historyPreset: HistoryPreset
  historyFrom: string
  historyTo: string
  signalStrategy: string
  signalInstrument: string
  signalPlan: string
  signalJob: string
  decisionCols: ColumnDef<ActivityRow>[]
  auditCols: ColumnDef<ActivityRow>[]
  reconCols: ColumnDef<ActivityRow>[]
  tradeBook: "ALL" | "PAPER" | "LIVE"
  onTradeBook: (v: "ALL" | "PAPER" | "LIVE") => void
  onClearPaper: () => void
  onHistoryPreset: (v: HistoryPreset) => void
  onHistoryFrom: (v: string) => void
  onHistoryTo: (v: string) => void
  onSignalStrategy: (v: string) => void
  onSignalInstrument: (v: string) => void
  onSignalPlan: (v: string) => void
  onSignalJob: (v: string) => void
  onClearFeed: (feed: "alerts" | "signals", mode: FeedClearMode) => void
}) {
  if (tab === "alerts") {
    return (
      <AlertsPanel
        alerts={alerts}
        errorCount={alertErrors}
        warnCount={alertWarns}
        preset={historyPreset}
        from={historyFrom}
        to={historyTo}
        onPreset={onHistoryPreset}
        onFrom={onHistoryFrom}
        onTo={onHistoryTo}
        onClear={mode => onClearFeed("alerts", mode)}
      />
    )
  }

  if (tab === "signals") {
    return (
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
        onPreset={onHistoryPreset}
        onFrom={onHistoryFrom}
        onTo={onHistoryTo}
        onStrategy={onSignalStrategy}
        onInstrument={onSignalInstrument}
        onPlanRef={onSignalPlan}
        onJobId={onSignalJob}
        onClear={mode => onClearFeed("signals", mode)}
      />
    )
  }

  if (tab === "decisions") {
    return (
      <>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel>Book</InputLabel>
            <Select
              label="Book"
              value={tradeBook}
              onChange={e => onTradeBook(e.target.value as typeof tradeBook)}
            >
              <MenuItem value="ALL">All books</MenuItem>
              <MenuItem value="PAPER">Paper / mock</MenuItem>
              <MenuItem value="LIVE">Live / recon</MenuItem>
            </Select>
          </FormControl>
          <BooksToolbarMenu onClearPaper={onClearPaper} />
          <HistoryPeriod
            preset={historyPreset}
            from={historyFrom}
            to={historyTo}
            onPreset={onHistoryPreset}
            onFrom={onHistoryFrom}
            onTo={onHistoryTo}
          />
        </Stack>
        <PageSection
          title="Decisions"
          description="Risk and routing outcomes for the selected book and period."
          flush
        >
          <RecordTable
            columns={decisionCols}
            data={decisions}
            minWidth={720}
            emptyMessage="No risk or routing decisions in this period."
          />
        </PageSection>
      </>
    )
  }

  if (tab === "activity") {
    return (
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <HistoryPeriod
            preset={historyPreset}
            from={historyFrom}
            to={historyTo}
            onPreset={onHistoryPreset}
            onFrom={onHistoryFrom}
            onTo={onHistoryTo}
          />
        </Stack>
        <PageSection
          title="Audit"
          description="Operator and system audit log for the period."
          flush
        >
          <RecordTable
            columns={auditCols}
            data={audit}
            minWidth={560}
            emptyMessage="No audit rows."
          />
        </PageSection>
        <PageSection
          title="Reconciliation"
          description="Broker reconcile events in the period."
          flush
        >
          <RecordTable
            columns={reconCols}
            data={recon}
            minWidth={640}
            emptyMessage="No reconciliation events in this period."
          />
        </PageSection>
      </Stack>
    )
  }

  return null
}
