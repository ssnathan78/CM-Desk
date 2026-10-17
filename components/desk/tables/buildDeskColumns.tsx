import { Chip } from "@mui/material"
import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { formatInr, formatIstDateTime } from "../../../lib/format"
import { labelFor } from "../../../lib/ui/labels"
import BookBadge from "../../figures/BookBadge"
import Figure from "../../figures/Figure"
import type { PositionRow } from "../PositionDetailDrawer"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    align?: "left" | "right"
    pin?: boolean
  }
}

export type ActivityRow = Record<string, unknown>

function bookBadgeFromProvenance(v: string) {
  if (!v) return "—"
  const book = v === "LIVE" || v === "RECONCILED" ? "LIVE" : v === "MOCK" ? "MOCK" : "PAPER"
  return <BookBadge book={book} />
}

function strategyCell(getValue: () => unknown) {
  const v = String(getValue() || "")
  return v ? labelFor(v) : "—"
}

export function sortPositions(rows: PositionRow[]): PositionRow[] {
  return [...rows].sort((a, b) => {
    const aOpen = Number(a.quantity) !== 0 && a.status === "OPEN" ? 0 : 1
    const bOpen = Number(b.quantity) !== 0 && b.status === "OPEN" ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    const strat = String(a.strategy || "").localeCompare(String(b.strategy || ""))
    if (strat !== 0) return strat
    return String(a.tradingsymbol).localeCompare(String(b.tradingsymbol))
  })
}

export function positionColumns(
  actionsCell: (row: PositionRow) => ReactNode
): ColumnDef<PositionRow>[] {
  return [
    {
      id: "symbol",
      header: "Symbol",
      accessorKey: "tradingsymbol",
      meta: { pin: true },
      cell: ({ row }) => row.original.tradingsymbol,
    },
    {
      header: "Strategy",
      accessorKey: "strategy",
      cell: ({ getValue }) => {
        const v = String(getValue() || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Book",
      accessorKey: "provenance",
      cell: ({ getValue }) => {
        const v = String(getValue() || "PAPER")
        const book = v === "LIVE" || v === "RECONCILED" ? "LIVE" : "PAPER"
        return <BookBadge book={book} />
      },
    },
    {
      header: "Product",
      accessorKey: "product",
      cell: ({ getValue }) => String(getValue() || "—"),
    },
    {
      header: "Qty",
      accessorKey: "quantity",
      meta: { align: "right" },
      cell: ({ getValue }) => String(getValue()),
    },
    {
      header: "Avg (₹)",
      meta: { align: "right" },
      cell: ({ row }) => {
        const flat = Number(row.original.quantity) === 0
        return <Figure kind="price" value={row.original.averageEntryPrice} flat={flat} />
      },
    },
    {
      header: "Mark (₹)",
      meta: { align: "right" },
      cell: ({ row }) => <Figure kind="price" value={row.original.markPrice} />,
    },
    {
      header: "Unrealised P&L (₹)",
      meta: { align: "right" },
      cell: ({ row }) => {
        const flat = Number(row.original.quantity) === 0
        return <Figure kind="inr" value={flat ? "0" : row.original.unrealizedPnl} pnl />
      },
    },
    {
      header: "Realized lifetime (₹)",
      meta: { align: "right" },
      cell: ({ row }) => <Figure kind="inr" value={row.original.realizedPnl} pnl />,
    },
    {
      header: "Status",
      cell: ({ row }) => {
        const flat = Number(row.original.quantity) === 0
        return (
          <Chip
            size="small"
            label={flat ? "Flat" : "Open"}
            variant="outlined"
            color={flat ? "default" : "success"}
          />
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => actionsCell(row.original),
    },
  ]
}

export type SessionRow = {
  sessionDate: string
  netPnl: string
  fees: string
  tradeCount: number
  winCount: number
  winRate: string
  maxDrawdown: string
}

export function sessionColumns(): ColumnDef<SessionRow>[] {
  return [
    { header: "Date (IST)", accessorKey: "sessionDate", meta: { pin: true } },
    {
      header: "Net P&L (₹)",
      accessorKey: "netPnl",
      meta: { align: "right" },
      cell: ({ getValue }) => <Figure kind="inr" value={getValue() as string} pnl />,
    },
    {
      header: "Fees (₹)",
      accessorKey: "fees",
      meta: { align: "right" },
      cell: ({ getValue }) => formatInr(getValue() as string),
    },
    {
      header: "Trades",
      accessorKey: "tradeCount",
      meta: { align: "right" },
    },
    {
      header: "Wins",
      accessorKey: "winCount",
      meta: { align: "right" },
    },
    {
      header: "Win rate",
      accessorKey: "winRate",
      meta: { align: "right" },
      cell: ({ getValue }) => <Figure kind="pct" value={getValue() as string} />,
    },
    {
      header: "Max drawdown (₹)",
      accessorKey: "maxDrawdown",
      meta: { align: "right" },
      cell: ({ getValue }) => formatInr(getValue() as string),
    },
  ]
}

export function mapSessionRow(row: Record<string, unknown>): SessionRow {
  return {
    sessionDate: String(row.sessionDate),
    netPnl: String(row.netPnl),
    fees: String(row.fees),
    tradeCount: Number(row.tradeCount),
    winCount: Number(row.winCount),
    winRate: String(row.winRate),
    maxDrawdown: String(row.maxDrawdown),
  }
}

export function mapPositionRow(row: Record<string, unknown>): PositionRow {
  return {
    id: String(row.id),
    tradingsymbol: String(row.tradingsymbol),
    strategy: row.strategy as string | null,
    provenance: row.provenance as string | null,
    product: row.product as string | null,
    quantity: Number(row.quantity),
    averageEntryPrice: row.averageEntryPrice as string,
    markPrice: row.markPrice as string,
    unrealizedPnl: row.unrealizedPnl as string,
    realizedPnl: row.realizedPnl as string,
    status: String(row.status),
    updatedAt: row.updatedAt as string | null,
  }
}

export function orderPriceLabel(row: Record<string, unknown>) {
  const bits: string[] = []
  const avg = Number(row.averageFillPrice)
  const stop = Number(row.stopPrice)
  const limit = Number(row.limitPrice)
  if (Number.isFinite(avg) && avg > 0) bits.push(`Avg ${formatInr(row.averageFillPrice as string)}`)
  if (Number.isFinite(stop) && stop > 0) bits.push(`SL ${formatInr(row.stopPrice as string)}`)
  if (Number.isFinite(limit) && limit > 0) bits.push(`Lmt ${formatInr(row.limitPrice as string)}`)
  return bits.length ? bits.join(" · ") : "—"
}

export type OrderRow = Record<string, unknown>

export type TradeRow = {
  id: string
  entryAt: string
  exitAt: string
  tradingsymbol: string
  direction: string
  strategy?: string | null
  provenance?: string | null
  entryQty: number
  exitQty: number
  averageEntry: string
  averageExit: string
  netPnl: string
  exitReason?: string | null
  status: string
}

export function mapTradeRow(row: Record<string, unknown>): TradeRow {
  return {
    id: String(row.id),
    entryAt: String(row.entryAt ?? ""),
    exitAt: String(row.exitAt ?? ""),
    tradingsymbol: String(row.tradingsymbol),
    direction: String(row.direction),
    strategy: row.strategy as string | null,
    provenance: row.provenance as string | null,
    entryQty: Number(row.entryQty),
    exitQty: Number(row.exitQty),
    averageEntry: String(row.averageEntry),
    averageExit: String(row.averageExit),
    netPnl: String(row.netPnl),
    exitReason: row.exitReason as string | null,
    status: String(row.status),
  }
}

export function tradeColumns(when: (v: string) => string): ColumnDef<TradeRow>[] {
  return [
    {
      header: "Entry",
      meta: { pin: true },
      cell: ({ row }) => when(row.original.entryAt),
    },
    { header: "Exit", cell: ({ row }) => when(row.original.exitAt) },
    { header: "Symbol", accessorKey: "tradingsymbol" },
    {
      header: "Dir",
      accessorKey: "direction",
      cell: ({ getValue }) => {
        const v = String(getValue() || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Strategy",
      accessorKey: "strategy",
      cell: ({ getValue }) => strategyCell(getValue),
    },
    {
      header: "Book",
      accessorKey: "provenance",
      cell: ({ getValue }) => bookBadgeFromProvenance(String(getValue() || "")),
    },
    {
      header: "Entry / Exit qty",
      meta: { align: "right" },
      cell: ({ row }) => `${row.original.entryQty} / ${row.original.exitQty}`,
    },
    {
      header: "Avg in / out (₹)",
      meta: { align: "right" },
      cell: ({ row }) =>
        `${formatInr(row.original.averageEntry)} / ${formatInr(row.original.averageExit)}`,
    },
    {
      header: "Net P&L (₹)",
      accessorKey: "netPnl",
      meta: { align: "right" },
      cell: ({ getValue }) => <Figure kind="inr" value={getValue() as string} pnl />,
    },
    {
      header: "Exit reason",
      accessorKey: "exitReason",
      cell: ({ getValue }) => String(getValue() || "—"),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const v = String(getValue() || "")
        return v ? labelFor(v) : "—"
      },
    },
  ]
}

export function orderColumns(when: (v: string) => string): ColumnDef<OrderRow>[] {
  return [
    {
      header: "When",
      meta: { pin: true },
      cell: ({ row }) => when(row.original.createdAt as string),
    },
    { header: "Filled", cell: ({ row }) => when(row.original.filledAt as string) },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const v = String(getValue() || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Side",
      accessorKey: "side",
      cell: ({ getValue }) => {
        const v = String(getValue() || "")
        return v ? labelFor(v) : "—"
      },
    },
    { header: "Symbol", accessorKey: "tradingsymbol" },
    {
      header: "Filled / Qty",
      meta: { align: "right" },
      cell: ({ row }) => `${row.original.filledQty} / ${row.original.requestedQty}`,
    },
    { header: "Price", cell: ({ row }) => orderPriceLabel(row.original) },
    {
      header: "Type",
      cell: ({ row }) => {
        const v = String(row.original.orderType || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Purpose",
      accessorKey: "purpose",
      cell: ({ getValue }) => {
        const v = String(getValue() || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Book",
      cell: ({ row }) => {
        const v = String(row.original.provenance || "")
        if (!v) return "—"
        const book = v === "LIVE" || v === "RECONCILED" ? "LIVE" : v === "MOCK" ? "MOCK" : "PAPER"
        return <BookBadge book={book} />
      },
    },
    { header: "Tag", cell: ({ row }) => String(row.original.orderTag || "—") },
    {
      header: "Reason",
      cell: ({ row }) => {
        const raw = String(row.original.rejectReason || row.original.errorInfo || "")
        return raw ? labelFor(raw) : "—"
      },
    },
    { header: "Broker id", cell: ({ row }) => String(row.original.brokerOrderId || "—") },
  ]
}

export function decisionColumns(when: (v: string) => string): ColumnDef<ActivityRow>[] {
  return [
    {
      header: "When",
      meta: { pin: true },
      cell: ({ row }) => when(row.original.occurredAt as string),
    },
    {
      header: "Action",
      cell: ({ row }) => {
        const raw = String(row.original.action || "")
        return raw ? labelFor(raw) : "—"
      },
    },
    {
      header: "Strategy",
      cell: ({ row }) => {
        const v = String(row.original.strategy || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Symbol",
      cell: ({ row }) => String(row.original.tradingsymbol || row.original.instrument || "—"),
    },
    {
      header: "Book",
      cell: ({ row }) => bookBadgeFromProvenance(String(row.original.provenance || "")),
    },
    {
      header: "Risk",
      cell: ({ row }) => {
        const v = String(row.original.riskResult || "")
        return v ? labelFor(v) : "—"
      },
    },
    {
      header: "Reason",
      cell: ({ row }) => String(row.original.reason || row.original.intent || "—"),
    },
  ]
}

export function auditColumns(when: (v: string) => string): ColumnDef<ActivityRow>[] {
  return [
    {
      header: "When",
      meta: { pin: true },
      cell: ({ row }) => when(row.original.occurredAt as string),
    },
    {
      header: "Event",
      cell: ({ row }) => {
        const raw = String(row.original.eventType || "")
        return raw ? labelFor(raw) : "—"
      },
    },
    {
      header: "Instrument",
      cell: ({ row }) => {
        const v = String(row.original.instrument || "")
        return v ? labelFor(v) : "—"
      },
    },
    { header: "Actor", accessorKey: "actor", cell: ({ getValue }) => String(getValue() || "—") },
    {
      header: "Summary",
      cell: ({ row }) => String(row.original.summary || "—"),
    },
  ]
}

export function reconColumns(when: (v: string) => string): ColumnDef<ActivityRow>[] {
  return [
    {
      header: "When",
      meta: { pin: true },
      cell: ({ row }) => when(row.original.occurredAt as string),
    },
    {
      header: "Kind",
      cell: ({ row }) => {
        const raw = String(row.original.kind || "")
        return raw ? labelFor(raw) : "—"
      },
    },
    { header: "Symbol", cell: ({ row }) => String(row.original.tradingsymbol || "—") },
    { header: "Detail", cell: ({ row }) => String(row.original.detail || "—") },
    {
      header: "Resolved",
      cell: ({ row }) => (row.original.resolved ? "yes" : "no"),
    },
  ]
}
