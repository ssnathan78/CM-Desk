import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import {
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
import { useState } from "react"

import type { ChaseBookConfig } from "../../lib/chaseDefaults"
import { labelFor } from "../../lib/ui/labels"
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

export default function ChaseBooksTable({
  books,
  statuses,
  executionMode,
  showPriceCols,
  rowNotice,
  onRowClick,
  onEngineChange,
  onPauseChange,
  onMenuAction,
}: {
  books: ChaseBookConfig[]
  statuses: ChaseStatusRow[]
  executionMode: "PAPER" | "LIVE"
  showPriceCols: boolean
  rowNotice: Record<string, { text: string; severity: string }>
  onRowClick: (instrument: string) => void
  onEngineChange: (instrument: string, enabled: boolean) => void
  onPauseChange: (instrument: string, paused: boolean) => void
  onMenuAction: (instrument: string, action: "edit" | "square" | "reset" | "remove") => void
}) {
  const [menu, setMenu] = useState<{ instrument: string; anchor: HTMLElement } | null>(null)
  return (
    <>
      <ScrollTable minWidth={showPriceCols ? 1100 : 920}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Book</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell align="right">Qty</TableCell>
              {showPriceCols ? <TableCell align="right">Avg (₹)</TableCell> : null}
              {showPriceCols ? <TableCell align="right">Mark (₹)</TableCell> : null}
              <TableCell align="right">Open mark (₹)</TableCell>
              <TableCell>Contract</TableCell>
              <TableCell>Engine</TableCell>
              <TableCell>New entries</TableCell>
              <TableCell align="right">Lots</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {books.map(book => {
              const st = statuses.find(s => s.instrument === book.instrument)
              const qty = st?.netQty ?? 0
              const flat = qty === 0
              const notice = rowNotice[book.instrument]
              return (
                <TableRow
                  key={book.instrument}
                  hover
                  sx={{ cursor: "pointer", height: 32 }}
                  onClick={() => onRowClick(book.instrument)}
                >
                  <TableCell>
                    <Typography variant="body2">{labelFor(book.instrument)}</Typography>
                    {notice ? (
                      <Typography
                        variant="caption"
                        color={notice.severity === "error" ? "error" : "success.main"}
                      >
                        {notice.text}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{st?.current ?? "—"}</TableCell>
                  <TableCell>
                    <BookBadge book={executionMode} />
                  </TableCell>
                  <TableCell align="right">
                    <Figure kind="qty" value={qty} align="right" />
                  </TableCell>
                  {showPriceCols ? (
                    <TableCell align="right">
                      <Figure kind="price" value={st?.averageEntryPrice} flat={flat} />
                    </TableCell>
                  ) : null}
                  {showPriceCols ? (
                    <TableCell align="right">
                      <Figure kind="price" value={st?.markPrice} flat={flat} />
                    </TableCell>
                  ) : null}
                  <TableCell align="right">
                    <Figure kind="inr" value={st?.openMark ?? "0"} pnl />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    >
                      {st?.tradingsymbol ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Switch
                      checked={book.enabled}
                      onChange={e => onEngineChange(book.instrument, e.target.checked)}
                      aria-label={`Engine ${book.instrument}`}
                    />
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
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
                  <TableCell align="right">{book.lots}</TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      aria-label={`Menu ${book.instrument}`}
                      onClick={e =>
                        setMenu({ instrument: book.instrument, anchor: e.currentTarget })
                      }
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
      <Menu anchorEl={menu?.anchor ?? null} open={Boolean(menu)} onClose={() => setMenu(null)}>
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
