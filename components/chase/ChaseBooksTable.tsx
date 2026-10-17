import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import {
  chaseConfigDiffFields,
  chaseConfigPrimaryBook,
  chaseOpenClassifyShortLabel,
  type ChaseConfigField,
} from "../../lib/chase/chaseBookCompare"
import {
  chaseColumnsInOrder,
  type ChaseTableColumnId,
} from "../../lib/chase/chaseTableColumns"
import type { ChaseBookConfig } from "../../lib/chaseDefaults"
import { labelFor } from "../../lib/ui/labels"
import { color } from "../../src/tokens"
import BookBadge from "../figures/BookBadge"
import Figure from "../figures/Figure"
import ScrollTable from "../lib/ScrollTable"

export type ChaseStatusRow = {
  instrument: string
  current: string | null
  tradingsymbol: string | null
  netQty: number
  openMark: string
  averageEntryPrice?: string | null
  markPrice?: string | null
}

const BOOK_COL_MIN = 128

function pinBookHeader() {
  return {
    position: "sticky" as const,
    left: 0,
    top: 0,
    zIndex: 4,
    bgcolor: "background.paper",
    minWidth: BOOK_COL_MIN,
    boxShadow: "2px 0 4px -2px rgba(0,0,0,0.35)",
  }
}

function pinBookBody() {
  return {
    position: "sticky" as const,
    left: 0,
    zIndex: 1,
    bgcolor: "background.paper",
    minWidth: BOOK_COL_MIN,
    boxShadow: "2px 0 4px -2px rgba(0,0,0,0.25)",
  }
}

function diffCellSx(differs: boolean) {
  return differs ? { bgcolor: color.attention.subtle } : undefined
}

function ConfigValueCell({
  field,
  differs,
  primaryLabel,
  align = "right",
  children,
}: {
  field: ChaseConfigField
  differs: boolean
  primaryLabel: string
  align?: "left" | "right"
  children: ReactNode
}) {
  const inner = (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
      {children}
      {differs ? (
        <Typography
          component="span"
          variant="caption"
          color="warning.main"
          sx={{ ml: 0.5 }}
          aria-hidden
        >
          ≠
        </Typography>
      ) : null}
    </Box>
  )
  return (
    <TableCell align={align} sx={{ ...diffCellSx(differs), whiteSpace: "nowrap" }}>
      {differs ? (
        <Tooltip title={`Differs from ${primaryLabel} (${field})`}>
          <Box component="span">{inner}</Box>
        </Tooltip>
      ) : (
        inner
      )}
    </TableCell>
  )
}

function chaseDataCell(
  colId: ChaseTableColumnId,
  ctx: {
    book: ChaseBookConfig
    st: ChaseStatusRow | undefined
    qty: number
    flat: boolean
    diff: Set<ChaseConfigField>
    primaryLabel: string
    executionMode: "PAPER" | "LIVE"
    onEngineChange: (instrument: string, enabled: boolean) => void
    onPauseChange: (instrument: string, paused: boolean) => void
  }
) {
  const { book, st, qty, flat, diff, primaryLabel, executionMode, onEngineChange, onPauseChange } =
    ctx
  switch (colId) {
    case "emaPeriod":
      return (
        <ConfigValueCell
          key={colId}
          field="emaPeriod"
          differs={diff.has("emaPeriod")}
          primaryLabel={primaryLabel}
        >
          {book.emaPeriod}
        </ConfigValueCell>
      )
    case "bufferPercent":
      return (
        <ConfigValueCell
          key={colId}
          field="bufferPercent"
          differs={diff.has("bufferPercent")}
          primaryLabel={primaryLabel}
        >
          {book.bufferPercent}
        </ConfigValueCell>
      )
    case "marketProtectionPercent":
      return (
        <ConfigValueCell
          key={colId}
          field="marketProtectionPercent"
          differs={diff.has("marketProtectionPercent")}
          primaryLabel={primaryLabel}
        >
          {book.marketProtectionPercent}
        </ConfigValueCell>
      )
    case "entryLimitOffset":
      return (
        <ConfigValueCell
          key={colId}
          field="entryLimitOffset"
          differs={diff.has("entryLimitOffset")}
          primaryLabel={primaryLabel}
        >
          {book.entryLimitOffset}
        </ConfigValueCell>
      )
    case "openClassify":
      return (
        <ConfigValueCell
          key={colId}
          field="openClassify"
          differs={diff.has("openClassify")}
          primaryLabel={primaryLabel}
          align="left"
        >
          <Chip
            size="small"
            variant="outlined"
            label={chaseOpenClassifyShortLabel(book.openClassify)}
          />
        </ConfigValueCell>
      )
    case "state":
      return <TableCell key={colId}>{st?.current ?? "—"}</TableCell>
    case "mode":
      return (
        <TableCell key={colId}>
          <BookBadge book={executionMode} />
        </TableCell>
      )
    case "qty":
      return (
        <TableCell key={colId} align="right">
          <Figure kind="qty" value={qty} align="right" />
        </TableCell>
      )
    case "avg":
      return (
        <TableCell key={colId} align="right">
          <Figure kind="price" value={st?.averageEntryPrice} flat={flat} />
        </TableCell>
      )
    case "mark":
      return (
        <TableCell key={colId} align="right">
          <Figure kind="price" value={st?.markPrice} flat={flat} />
        </TableCell>
      )
    case "openMark":
      return (
        <TableCell key={colId} align="right">
          <Figure kind="inr" value={st?.openMark ?? "0"} pnl />
        </TableCell>
      )
    case "contract":
      return (
        <TableCell key={colId}>
          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
            {st?.tradingsymbol ?? "—"}
          </Typography>
        </TableCell>
      )
    case "engine":
      return (
        <TableCell key={colId} onClick={e => e.stopPropagation()}>
          <Switch
            checked={book.enabled}
            onChange={e => onEngineChange(book.instrument, e.target.checked)}
            aria-label={`Engine ${book.instrument}`}
          />
        </TableCell>
      )
    case "pause":
      return (
        <TableCell key={colId} onClick={e => e.stopPropagation()}>
          <Tooltip title={book.enabled ? "" : "Turn the engine on first."}>
            <span>
              <Switch
                checked={!book.paused}
                disabled={!book.enabled}
                onChange={e => onPauseChange(book.instrument, !e.target.checked)}
                aria-label={`New entries ${book.instrument}`}
              />
            </span>
          </Tooltip>
        </TableCell>
      )
    case "lots":
      return (
        <TableCell
          key={colId}
          align="right"
          sx={diff.has("lots") ? diffCellSx(true) : undefined}
          onClick={e => e.stopPropagation()}
        >
          {book.lots}
          {diff.has("lots") ? (
            <Typography
              component="span"
              variant="caption"
              color="warning.main"
              sx={{ ml: 0.5 }}
              aria-hidden
            >
              ≠
            </Typography>
          ) : null}
        </TableCell>
      )
    default:
      return null
  }
}

const HEADER_LABELS: Record<ChaseTableColumnId, string> = {
  emaPeriod: "EMA",
  bufferPercent: "Buffer %",
  marketProtectionPercent: "Protect %",
  entryLimitOffset: "Offset (₹)",
  openClassify: "Open",
  state: "State",
  mode: "Mode",
  qty: "Qty",
  avg: "Avg (₹)",
  mark: "Mark (₹)",
  openMark: "Open mark (₹)",
  contract: "Contract",
  engine: "Engine",
  pause: "New entries",
  lots: "Lots",
}

export default function ChaseBooksTable({
  books,
  statuses,
  executionMode,
  visibleColumns,
  onRowClick,
  onEngineChange,
  onPauseChange,
  onMenuAction,
}: {
  books: ChaseBookConfig[]
  statuses: ChaseStatusRow[]
  executionMode: "PAPER" | "LIVE"
  visibleColumns: ChaseTableColumnId[]
  onRowClick: (instrument: string) => void
  onEngineChange: (instrument: string, enabled: boolean) => void
  onPauseChange: (instrument: string, paused: boolean) => void
  onMenuAction: (instrument: string, action: "edit" | "square" | "reset" | "remove") => void
}) {
  const [menu, setMenu] = useState<{ instrument: string; anchor: HTMLElement } | null>(null)
  const primary = useMemo(() => chaseConfigPrimaryBook(books), [books])
  const primaryLabel = primary ? labelFor(primary.instrument) : "primary book"
  const cols = chaseColumnsInOrder(visibleColumns)

  return (
    <>
      <ScrollTable minWidth={960}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={pinBookHeader()}>Book</TableCell>
              {cols.map(id => (
                <TableCell
                  key={id}
                  align={
                    id === "openClassify" || id === "contract" || id === "state" || id === "mode"
                      ? "left"
                      : "right"
                  }
                >
                  {HEADER_LABELS[id]}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {books.map(book => {
              const st = statuses.find(s => s.instrument === book.instrument)
              const qty = st?.netQty ?? 0
              const flat = qty === 0
              const diff = chaseConfigDiffFields(book, primary)
              return (
                <TableRow
                  key={book.instrument}
                  hover
                  sx={{ cursor: "pointer", height: 32 }}
                  onClick={() => onRowClick(book.instrument)}
                >
                  <TableCell sx={{ ...pinBookBody(), whiteSpace: "nowrap" }}>
                    <Typography variant="body2" noWrap>
                      {labelFor(book.instrument)}
                    </Typography>
                  </TableCell>
                  {cols.map(colId =>
                    chaseDataCell(colId, {
                      book,
                      st,
                      qty,
                      flat,
                      diff,
                      primaryLabel,
                      executionMode,
                      onEngineChange,
                      onPauseChange,
                    })
                  )}
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      aria-label={`Menu ${book.instrument}`}
                      onClick={e => {
                        e.stopPropagation()
                        setMenu({ instrument: book.instrument, anchor: e.currentTarget })
                      }}
                    >
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollTable>
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Amber cells differ from {primaryLabel} (first enabled book in index order). Row click
          opens the drawer to edit parameters.
        </Typography>
      </Box>
      <Menu
        anchorEl={menu?.anchor ?? null}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {menu
          ? [
              <MenuItem
                key="edit"
                onClick={() => {
                  setMenu(null)
                  onMenuAction(menu.instrument, "edit")
                }}
              >
                Edit book…
              </MenuItem>,
              <MenuItem
                key="sq"
                onClick={() => {
                  setMenu(null)
                  onMenuAction(menu.instrument, "square")
                }}
              >
                Square off this book…
              </MenuItem>,
              <MenuItem
                key="reset"
                onClick={() => {
                  setMenu(null)
                  onMenuAction(menu.instrument, "reset")
                }}
              >
                Reset to fresh signal…
              </MenuItem>,
              <MenuItem
                key="rm"
                onClick={() => {
                  setMenu(null)
                  onMenuAction(menu.instrument, "remove")
                }}
              >
                Remove book…
              </MenuItem>,
            ]
          : null}
      </Menu>
    </>
  )
}
