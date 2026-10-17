import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material"
import type { ColumnDef } from "@tanstack/react-table"
import type { DeskTab } from "../../../lib/deskNavigation"
import type { HistoryPreset } from "../../../lib/trading/historyRange"
import type { PositionView } from "../../../lib/trading/types"
import PageSection from "../../lib/PageSection"
import RecordTable from "../../records/RecordTable"
import BooksToolbarMenu from "../BooksToolbarMenu"
import HistoryPeriod from "../HistoryPeriod"
import type { PositionRow } from "../PositionDetailDrawer"
import PositionDetailDrawer from "../PositionDetailDrawer"
import type { SessionRow, TradeRow } from "../tables/buildDeskColumns"

const filterFieldSx = {
  minWidth: { xs: "100%", sm: 160 },
  width: { xs: "100%", sm: "auto" },
}

export default function BooksView({
  tab,
  positionView,
  tradeBook,
  historyPreset,
  historyFrom,
  historyTo,
  positionCols,
  positionRows,
  positionDetail,
  orderCols,
  orders,
  tradeCols,
  tradeRows,
  sessionCols,
  sessionRows,
  onPositionView,
  onTradeBook,
  onHistoryPreset,
  onHistoryFrom,
  onHistoryTo,
  onClearPaper,
  onPositionDetail,
  onSquareOffDetail,
  onClearPhantomDetail,
  onSessionDrill,
}: {
  tab: DeskTab
  positionView: PositionView
  tradeBook: "ALL" | "PAPER" | "LIVE"
  historyPreset: HistoryPreset
  historyFrom: string
  historyTo: string
  positionCols: ColumnDef<PositionRow>[]
  positionRows: PositionRow[]
  positionDetail: PositionRow | null
  orderCols: ColumnDef<Record<string, unknown>>[]
  orders: Record<string, unknown>[]
  tradeCols: ColumnDef<TradeRow>[]
  tradeRows: TradeRow[]
  sessionCols: ColumnDef<SessionRow>[]
  sessionRows: SessionRow[]
  onPositionView: (v: PositionView) => void
  onTradeBook: (v: "ALL" | "PAPER" | "LIVE") => void
  onHistoryPreset: (v: HistoryPreset) => void
  onHistoryFrom: (v: string) => void
  onHistoryTo: (v: string) => void
  onClearPaper: () => void
  onPositionDetail: (row: PositionRow | null) => void
  onSquareOffDetail: () => void
  onClearPhantomDetail: () => void
  onSessionDrill: (sessionDate: string) => void
}) {
  const booksTab = tab === "positions" || tab === "orders" || tab === "trades" || tab === "sessions"
  if (!booksTab) return null

  const showBookFilters = tab === "positions" || tab === "orders" || tab === "trades"

  return (
    <>
      {showBookFilters ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.5 }}>
          {tab === "positions" ? (
            <FormControl size="small" sx={filterFieldSx}>
              <InputLabel>Show</InputLabel>
              <Select
                label="Show"
                value={positionView}
                onChange={e => onPositionView(e.target.value as PositionView)}
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
                onChange={e => onTradeBook(e.target.value as typeof tradeBook)}
              >
                <MenuItem value="ALL">All books</MenuItem>
                <MenuItem value="PAPER">Paper / mock</MenuItem>
                <MenuItem value="LIVE">Live / recon</MenuItem>
              </Select>
            </FormControl>
          )}
          <BooksToolbarMenu onClearPaper={onClearPaper} />
          {tab !== "positions" ? (
            <HistoryPeriod
              preset={historyPreset}
              from={historyFrom}
              to={historyTo}
              onPreset={onHistoryPreset}
              onFrom={onHistoryFrom}
              onTo={onHistoryTo}
            />
          ) : null}
        </Stack>
      ) : null}

      {tab === "positions" ? (
        <PageSection
          title="Positions"
          description="Ledger books; square off or clear phantom from the row drawer."
          flush
        >
          <RecordTable
            columns={positionCols}
            data={positionRows}
            minWidth={880}
            onRowClick={row => onPositionDetail(row)}
            emptyMessage="No positions in the ledger yet."
          />
          <PositionDetailDrawer
            row={positionDetail}
            onClose={() => onPositionDetail(null)}
            onSquareOff={onSquareOffDetail}
            onClearPhantom={onClearPhantomDetail}
          />
          {positionRows.length === 0 ? (
            <Typography sx={{ p: 2 }} color="text.secondary">
              Punch a trade or run Reconcile. Square off sends a flatten for an open book. Clear
              phantom zeros a leftover ledger row and does not send a Kite order.
            </Typography>
          ) : (
            <Typography sx={{ p: 2 }} color="text.secondary" variant="body2">
              Square off flattens the open book (paper or live) without halting the desk. Clear
              phantom zeros a leftover ledger row after proving Kite is flat (paper rows skip Kite).
              It does not flatten the broker. Reconcile if Kite has size the ledger missed.
            </Typography>
          )}
        </PageSection>
      ) : null}

      {tab === "orders" ? (
        <PageSection
          title="Orders"
          description="Ledger working and completed orders for the selected book."
          flush
        >
          <RecordTable
            columns={orderCols}
            data={orders}
            minWidth={880}
            emptyMessage="No ledger orders in this book."
          />
          {orders.length === 0 ? (
            <Typography sx={{ p: 2 }} color="text.secondary" variant="body2">
              A job that never punched (Sunday, risk block, enqueue fail) is not an order — see
              Alerts.
            </Typography>
          ) : null}
        </PageSection>
      ) : null}

      {tab === "trades" ? (
        <PageSection
          title="Trades"
          description="Completed round-trips in the selected period."
          flush
        >
          <RecordTable
            columns={tradeCols}
            data={tradeRows}
            minWidth={800}
            emptyMessage="No completed trades in this period."
          />
        </PageSection>
      ) : null}

      {tab === "sessions" ? (
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
            title="Sessions"
            description="Closed strategy sessions; click a row to filter Trades."
            flush
          >
            <RecordTable
              columns={sessionCols}
              data={sessionRows}
              minWidth={560}
              emptyMessage="No closed sessions in this period."
              onRowClick={row => onSessionDrill(row.sessionDate)}
            />
          </PageSection>
        </Stack>
      ) : null}
    </>
  )
}
