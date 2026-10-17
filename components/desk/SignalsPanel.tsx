import {
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Link as MuiLink,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import NextLink from "next/link"
import { Fragment, useMemo, useState } from "react"
import { hrefForDeskLink } from "../../lib/desk/deepLinks"
import type { FeedPeriod } from "../../lib/trading/feedWindow"
import type { HistoryPreset } from "../../lib/trading/historyRange"
import type { SignalFilters, StrategySignal } from "../../lib/trading/signals"
import { labelFor } from "../../lib/ui/labels"
import { signalExplain } from "../../lib/ui/signalExplain"
import { groupConsecutiveSignals } from "../../lib/ui/signalGrouping"
import PageSection from "../lib/PageSection"
import ScrollTable from "../lib/ScrollTable"
import FeedClearMenu from "./FeedClearMenu"
import FeedToolbar from "./FeedToolbar"

function when(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
}

function outcomeColor(outcome: string) {
  if (outcome === "ENTER") return "success"
  if (outcome === "REJECT" || outcome === "INVALID") return "error"
  if (outcome === "WAIT" || outcome === "HOLD") return "info"
  if (outcome === "ADJUST" || outcome === "EXIT") return "warning"
  return "default"
}

function SignalCells({ row }: { row: StrategySignal }) {
  const explain = signalExplain(row)
  return (
    <>
      <TableCell>{when(row.occurredAt)}</TableCell>
      <TableCell>
        <Chip
          size="small"
          label={labelFor(`SIGNAL_${row.outcome}`) || labelFor(row.outcome)}
          color={outcomeColor(row.outcome)}
          variant="outlined"
        />
      </TableCell>
      <TableCell>{labelFor(row.kind) || row.kind}</TableCell>
      <TableCell>
        <Typography variant="body2">{row.summary}</Typography>
        {explain && explain !== row.summary ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {explain}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell>{row.strategy ? labelFor(row.strategy) : "—"}</TableCell>
      <TableCell>{row.instrument ? labelFor(row.instrument) : row.tradingsymbol || "—"}</TableCell>
      <TableCell>
        {row.jobId ? (
          <MuiLink
            component={NextLink}
            href={hrefForDeskLink({
              pathname: "/desk",
              query: { view: "now", tab: "today" },
            })}
            underline="hover"
          >
            {row.jobName || row.orderTag || row.jobId}
          </MuiLink>
        ) : (
          row.jobName || row.orderTag || row.planRef || "—"
        )}
      </TableCell>
    </>
  )
}

export default function SignalsPanel({
  signals,
  filters,
  preset,
  from,
  to,
  strategy,
  instrument,
  planRef,
  jobId,
  onPreset,
  onFrom,
  onTo,
  onStrategy,
  onInstrument,
  onPlanRef,
  onJobId,
  onClear,
}: {
  signals: StrategySignal[]
  filters: SignalFilters
  preset: HistoryPreset
  from: string
  to: string
  strategy: string
  instrument: string
  planRef: string
  jobId: string
  onPreset: (preset: HistoryPreset) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onStrategy: (value: string) => void
  onInstrument: (value: string) => void
  onPlanRef: (value: string) => void
  onJobId: (value: string) => void
  onClear: (period: FeedPeriod) => void
}) {
  const [groupRepeats, setGroupRepeats] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const views = useMemo(
    () =>
      groupRepeats
        ? groupConsecutiveSignals(signals)
        : signals.map(row => ({ mode: "single" as const, row })),
    [signals, groupRepeats]
  )

  return (
    <PageSection
      title="Signals"
      description="Persisted Chase, straddle skew, and strangle strike evaluations. Filter by instrument or job."
      flush
    >
      <FeedToolbar
        preset={preset}
        from={from}
        to={to}
        onPreset={onPreset}
        onFrom={onFrom}
        onTo={onTo}
        onClear={onClear}
        extra={
          <>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={groupRepeats}
                  onChange={e => setGroupRepeats(e.target.checked)}
                />
              }
              label="Group repeats"
            />
            <FeedClearMenu kind="signals" onClear={onClear} />
            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", md: 160 }, width: { xs: "100%", md: "auto" } }}
            >
              <InputLabel>Strategy</InputLabel>
              <Select label="Strategy" value={strategy} onChange={e => onStrategy(e.target.value)}>
                <MenuItem value="">All strategies</MenuItem>
                {filters.strategies.map(key => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", md: 160 }, width: { xs: "100%", md: "auto" } }}
            >
              <InputLabel>Instrument</InputLabel>
              <Select
                label="Instrument"
                value={instrument}
                onChange={e => onInstrument(e.target.value)}
              >
                <MenuItem value="">All instruments</MenuItem>
                {filters.instruments.map(key => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", md: 160 }, width: { xs: "100%", md: "auto" } }}
            >
              <InputLabel>Plan</InputLabel>
              <Select label="Plan" value={planRef} onChange={e => onPlanRef(e.target.value)}>
                <MenuItem value="">All plans</MenuItem>
                {filters.planRefs.map(key => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", md: 200 }, width: { xs: "100%", md: "auto" } }}
            >
              <InputLabel>Job</InputLabel>
              <Select label="Job" value={jobId} onChange={e => onJobId(e.target.value)}>
                <MenuItem value="">All jobs</MenuItem>
                {filters.jobs.map(job => (
                  <MenuItem key={job.id} value={job.id}>
                    {job.name || job.orderTag || job.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        }
      />
      <ScrollTable minWidth={800}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When (IST)</TableCell>
              <TableCell>Outcome</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>What the engine saw</TableCell>
              <TableCell>Strategy</TableCell>
              <TableCell>Instrument</TableCell>
              <TableCell>Trade</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {views.map(view => {
              if (view.mode === "single") {
                return (
                  <TableRow key={view.row.id}>
                    <SignalCells row={view.row} />
                  </TableRow>
                )
              }
              const isOpen = expanded[view.key]
              return (
                <Fragment key={view.key}>
                  <TableRow
                    hover
                    onClick={() => setExpanded(prev => ({ ...prev, [view.key]: !prev[view.key] }))}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      {when(view.first.occurredAt)}
                      {view.count > 1 ? ` → ${when(view.last.occurredAt)}` : ""}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={`${view.first.outcome} ×${view.count}`}
                        color={outcomeColor(view.first.outcome)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{view.first.kind}</TableCell>
                    <TableCell>{view.first.summary}</TableCell>
                    <TableCell>{view.first.strategy || "—"}</TableCell>
                    <TableCell>
                      {view.first.instrument || view.first.tradingsymbol || "—"}
                    </TableCell>
                    <TableCell>
                      {view.first.jobName || view.first.orderTag || view.first.planRef || "—"}
                    </TableCell>
                  </TableRow>
                  {isOpen
                    ? view.rows.map(row => (
                        <TableRow key={row.id} sx={{ bgcolor: "action.hover" }}>
                          <SignalCells row={row} />
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </ScrollTable>
      {signals.length === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary">
          No signals in this filter. Chase writes one row each hour (including “waiting for
          signal”). Straddle writes sampled skew waits plus the accept/reject.
        </Typography>
      ) : null}
    </PageSection>
  )
}
