import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import {
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import Link from "next/link"
import { useState } from "react"
import useSWR from "swr"

import { chaseStatusNeedsManagement } from "../../lib/chaseUniverse"
import { useDeskStatus } from "../../lib/hooks/useDeskStatus"
import { CHASE_GROUP_PNL_TITLE, intradaySwitchLabel } from "../../lib/operatorActionCopy"
import type { RiskStrategyKey } from "../../lib/trading/riskEngine"
import type { StrategyRealizedRow, TodayGroupRow } from "../../lib/trading/todayGroups"
import { deriveStrategyDeskLine } from "../../lib/ui/deskStatus"
import BookBadge from "../figures/BookBadge"
import Figure from "../figures/Figure"
import PageSection from "../lib/PageSection"
import ScrollTable from "../lib/ScrollTable"

type ChaseBookStatus = {
  instrument: string
  current: string | null
  netQty: number
  openMark: string
}

type BoardRow = {
  id: string
  strategyLabel: string
  strategyKey?: RiskStrategyKey
  chaseInstrument?: string
  stateLabel: string
  deskLabel: string
  deskTone: "neutral" | "attention" | "danger" | "live" | "paper" | "mock"
  mode: "PAPER" | "LIVE"
  openHeader: "Open" | "Qty"
  openValue: number | string
  openMark: string
  closedToday: string
  realized: string
  engineLabel: string
  showGroupPnl: boolean
  href: string
  showChaseSquareOff?: boolean
}

function rowForGroup(
  group: TodayGroupRow,
  key: RiskStrategyKey,
  desk: ReturnType<typeof useDeskStatus>["data"],
  realized: StrategyRealizedRow[]
): BoardRow {
  const strat = desk?.strategies[key]
  const deskLine = strat ? deriveStrategyDeskLine(strat) : { label: "—", tone: "neutral" as const }
  const realizedRow = realized.find(r => r.id === group.id)
  return {
    id: group.id,
    strategyLabel: group.label,
    strategyKey: key,
    stateLabel: group.open > 0 ? `Open ${group.open}` : "Flat",
    deskLabel: deskLine.label,
    deskTone: deskLine.tone === "live" || deskLine.tone === "paper" ? "neutral" : deskLine.tone,
    mode: strat?.executionMode ?? "PAPER",
    openHeader: "Open",
    openValue: group.open,
    openMark: group.openMark,
    closedToday: group.closedToday,
    realized: realizedRow?.realized ?? "0",
    engineLabel: strat?.enabled ? "Desk on" : "Desk off",
    showGroupPnl: true,
    href:
      key === "CHASE"
        ? "/chase"
        : key === "MOMENTUM"
          ? "/momentum"
          : key === "DAILY_TREND"
            ? "/daily-trend"
            : "/plan",
  }
}

export default function StrategyBoard({
  todayRows,
  realizedRows,
  onChaseSquareOff,
}: {
  todayRows: TodayGroupRow[]
  realizedRows: StrategyRealizedRow[]
  onChaseSquareOff?: (instrument: string) => void
}) {
  const { data: desk } = useDeskStatus()
  const { data: chaseData } = useSWR("/api/chase-settings")
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null)

  const intraday = todayRows.find(r => r.id === "intraday")
  const momentum = todayRows.find(r => r.id === "momentum")
  const daily = todayRows.find(r => r.id === "daily")

  const rows: BoardRow[] = []
  if (intraday) {
    const straddle = desk?.strategies.ATM_STRADDLE
    const strangle = desk?.strategies.ATM_STRANGLE
    const deskLine =
      straddle && !straddle.enabled
        ? deriveStrategyDeskLine(straddle)
        : strangle && !strangle.enabled
          ? deriveStrategyDeskLine(strangle)
          : straddle
            ? deriveStrategyDeskLine(straddle)
            : { label: "—", tone: "neutral" as const }
    const mode =
      straddle?.executionMode === "LIVE" || strangle?.executionMode === "LIVE" ? "LIVE" : "PAPER"
    const realizedRow = realizedRows.find(r => r.id === "intraday")
    rows.push({
      id: "intraday",
      strategyLabel: intraday.label,
      stateLabel: intraday.open > 0 ? `Open ${intraday.open}` : "Flat",
      deskLabel: deskLine.label,
      deskTone: deskLine.tone,
      mode,
      openHeader: "Open",
      openValue: intraday.open,
      openMark: intraday.openMark,
      closedToday: intraday.closedToday,
      realized: realizedRow?.realized ?? "0",
      engineLabel: intradaySwitchLabel(Boolean(straddle?.enabled), Boolean(strangle?.enabled)),
      showGroupPnl: true,
      href: "/plan",
    })
  }
  const statuses = (chaseData?.statuses ?? []) as ChaseBookStatus[]
  const books = chaseData?.books ?? []
  let chaseRow = 0
  for (const book of books) {
    const st = statuses.find(s => s.instrument === book.instrument)
    const netQty = st?.netQty ?? 0
    const current = st?.current ?? null
    if (!book.enabled && netQty === 0 && !chaseStatusNeedsManagement(current)) continue
    const strat = desk?.strategies.CHASE
    const deskLine = strat
      ? deriveStrategyDeskLine(strat)
      : { label: "—", tone: "neutral" as const }
    const chaseRealized = realizedRows.find(r => r.id === "chase")
    rows.push({
      id: `chase-${book.instrument}`,
      strategyLabel: `Chase · ${book.instrument}`,
      strategyKey: "CHASE",
      chaseInstrument: book.instrument,
      stateLabel: current ?? "—",
      deskLabel: deskLine.label,
      deskTone: deskLine.tone,
      mode: strat?.executionMode ?? "PAPER",
      openHeader: "Qty",
      openValue: netQty,
      openMark: st?.openMark ?? "0",
      closedToday: todayRows.find(r => r.id === "chase")?.closedToday ?? "0",
      realized: chaseRealized?.realized ?? "0",
      engineLabel: book.enabled ? "Book on" : "Book off",
      showGroupPnl: chaseRow === 0,
      href: "/chase",
      showChaseSquareOff: netQty !== 0 && strat?.enabled !== false,
    })
    chaseRow += 1
  }
  if (momentum) {
    rows.push(rowForGroup(momentum, "MOMENTUM", desk, realizedRows))
  }
  if (daily) {
    rows.push(rowForGroup(daily, "DAILY_TREND", desk, realizedRows))
  }

  return (
    <PageSection
      title="Strategy board"
      description="Open books, desk permission, and today’s closed P&L by strategy."
      flush
    >
      <ScrollTable minWidth={960}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Strategy</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Desk</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell align="right">Open / Qty</TableCell>
              <TableCell align="right">Open mark (₹)</TableCell>
              <TableCell align="right">Closed today (₹)</TableCell>
              <TableCell
                align="right"
                title="Lifetime realized on the books. Not today, not Kite day P&L."
              >
                Realized lifetime (₹)
              </TableCell>
              <TableCell>Switch</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant="body2">{row.strategyLabel}</Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={row.stateLabel} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.deskLabel}
                    color={
                      row.deskTone === "danger"
                        ? "error"
                        : row.deskTone === "attention"
                          ? "warning"
                          : "default"
                    }
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <BookBadge book={row.mode} />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {row.openHeader}
                  </Typography>
                  {row.openHeader === "Qty" ? (
                    <Figure kind="qty" value={row.openValue as number} align="right" />
                  ) : (
                    row.openValue
                  )}
                </TableCell>
                <TableCell align="right">
                  <Figure kind="inr" value={row.openMark} pnl />
                </TableCell>
                <TableCell
                  align="right"
                  title={row.showGroupPnl ? undefined : CHASE_GROUP_PNL_TITLE}
                >
                  {row.showGroupPnl ? <Figure kind="inr" value={row.closedToday} pnl /> : "—"}
                </TableCell>
                <TableCell
                  align="right"
                  title={row.showGroupPnl ? undefined : CHASE_GROUP_PNL_TITLE}
                >
                  {row.showGroupPnl ? <Figure kind="inr" value={row.realized} pnl /> : "—"}
                </TableCell>
                <TableCell>{row.engineLabel}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={`Actions for ${row.strategyLabel}`}
                    onClick={e => setMenu({ id: row.id, anchor: e.currentTarget })}
                  >
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
      <Menu anchorEl={menu?.anchor ?? null} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {(() => {
          const r = rows.find(row => row.id === menu?.id)
          if (!r) return null
          return [
            <MenuItem key="open" component={Link} href={r.href} onClick={() => setMenu(null)}>
              Open page
            </MenuItem>,
            r.showChaseSquareOff && r.chaseInstrument && onChaseSquareOff ? (
              <MenuItem
                key="sq"
                onClick={() => {
                  setMenu(null)
                  if (r.chaseInstrument) onChaseSquareOff(r.chaseInstrument)
                }}
              >
                Square off {r.chaseInstrument}…
              </MenuItem>
            ) : null,
          ]
        })()}
      </Menu>
    </PageSection>
  )
}
