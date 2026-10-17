import {
  Alert,
  Chip,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import NextLink from "next/link"
import { alertTarget, hrefForDeskLink } from "../../lib/desk/deepLinks"
import type { FeedPeriod } from "../../lib/trading/feedWindow"
import type { HistoryPreset } from "../../lib/trading/historyRange"
import { labelFor } from "../../lib/ui/labels"
import PageSection from "../lib/PageSection"
import ScrollTable from "../lib/ScrollTable"
import FeedClearMenu from "./FeedClearMenu"
import FeedToolbar from "./FeedToolbar"

type OperatorAlert = {
  id: string
  occurredAt: string
  severity: "ERROR" | "WARN" | "INFO"
  source: string
  code: string
  summary: string
  strategy?: string | null
  instrument?: string | null
  jobId?: string | null
  orderId?: string | null
}

function when(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
}

export default function AlertsPanel({
  alerts,
  errorCount,
  warnCount,
  preset,
  from,
  to,
  onPreset,
  onFrom,
  onTo,
  onClear,
}: {
  alerts: OperatorAlert[]
  errorCount: number
  warnCount: number
  preset: HistoryPreset
  from: string
  to: string
  onPreset: (preset: HistoryPreset) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onClear: (period: FeedPeriod) => void
}) {
  return (
    <PageSection
      title="Alerts"
      description="Failures that never became a Kite or ledger order plus broker rejects. Orders tab is the blotter."
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
        extra={<FeedClearMenu label="Hide alerts" onClear={onClear} />}
      />
      {errorCount + warnCount > 0 ? (
        <Alert severity={errorCount ? "error" : "warning"} sx={{ mx: 2, mt: 1.5 }}>
          {errorCount} error{errorCount === 1 ? "" : "s"}
          {warnCount ? ` · ${warnCount} warning${warnCount === 1 ? "" : "s"}` : ""} in this view
        </Alert>
      ) : null}
      <ScrollTable minWidth={720}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When (IST)</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>What happened</TableCell>
              <TableCell>Strategy</TableCell>
              <TableCell>Instrument</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alerts.map(row => (
              <TableRow key={row.id}>
                <TableCell>{when(row.occurredAt)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.severity}
                    color={
                      row.severity === "ERROR"
                        ? "error"
                        : row.severity === "WARN"
                          ? "warning"
                          : "default"
                    }
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{row.source}</TableCell>
                <TableCell>
                  <MuiLink
                    component={NextLink}
                    href={hrefForDeskLink(alertTarget(row))}
                    underline="hover"
                  >
                    {labelFor(row.code)}
                  </MuiLink>
                </TableCell>
                <TableCell>
                  <MuiLink
                    component={NextLink}
                    href={hrefForDeskLink(alertTarget(row))}
                    underline="hover"
                  >
                    {row.summary}
                  </MuiLink>
                  {row.jobId ? (
                    <>
                      {" · "}
                      <MuiLink
                        component={NextLink}
                        href={hrefForDeskLink({
                          pathname: "/desk",
                          query: { view: "why", tab: "signals", jobId: row.jobId },
                        })}
                        underline="hover"
                      >
                        Open job
                      </MuiLink>
                    </>
                  ) : null}
                </TableCell>
                <TableCell>{row.strategy ? labelFor(row.strategy) : "—"}</TableCell>
                <TableCell>{row.instrument ? labelFor(row.instrument) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
      {alerts.length === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary">
          No operator alerts. A rejected “Schedule now” on a Sunday or a live punch that never
          reached Kite will show up here, not under Orders. Today’s job cards stay on{" "}
          <MuiLink component={NextLink} href="/desk?tab=today">
            Desk → Today
          </MuiLink>
          .
        </Typography>
      ) : null}
    </PageSection>
  )
}
