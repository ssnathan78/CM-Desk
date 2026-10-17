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
  type ChaseConfigField,
  chaseConfigDiffFields,
  chaseConfigPrimaryBook,
  chaseOpenClassifyShortLabel,
} from "../../lib/chase/chaseBookCompare"
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

const groupBorder = { borderLeft: 1, borderColor: "divider" }

function diffCellSx(differs: boolean) {
  return differs
    ? {
        bgcolor: color.attention.subtle,
      }
    : undefined
}

function ConfigValueCell({
  field,
  differs,
  primaryLabel,
  align = "right",
  firstInGroup,
  children,
}: {
  field: ChaseConfigField
  differs: boolean
  primaryLabel: string
  align?: "left" | "right"
  firstInGroup?: boolean
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
    <TableCell
      align={align}
      sx={{
        ...(firstInGroup ? groupBorder : {}),
        ...diffCellSx(differs),
        whiteSpace: "nowrap",
      }}
    >
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
  const primary = useMemo(() => chaseConfigPrimaryBook(books), [books])
  const primaryLabel = primary ? labelFor(primary.instrument) : "primary book"

  const minWidth = showPriceCols ? 1320 : 1180

  return (
    <>
      <ScrollTable minWidth={minWidth}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2}>Book</TableCell>
              <TableCell colSpan={5} align="center" sx={groupBorder}>
                Configuration
              </TableCell>
              <TableCell colSpan={showPriceCols ? 7 : 5} align="center" sx={groupBorder}>
                Runtime
              </TableCell>
              <TableCell colSpan={3} align="center" sx={groupBorder}>
                Controls
              </TableCell>
              <TableCell rowSpan={2} />
            </TableRow>
            <TableRow>
              <TableCell align="right" sx={groupBorder}>
                EMA
              </TableCell>
              <TableCell align="right">Buffer %</TableCell>
              <TableCell align="right">Protect %</TableCell>
              <TableCell align="right">Offset (₹)</TableCell>
              <TableCell>Open</TableCell>
              <TableCell sx={groupBorder}>State</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell align="right">Qty</TableCell>
              {showPriceCols ? <TableCell align="right">Avg (₹)</TableCell> : null}
              {showPriceCols ? <TableCell align="right">Mark (₹)</TableCell> : null}
              <TableCell align="right">Open mark (₹)</TableCell>
              <TableCell>Contract</TableCell>
              <TableCell sx={groupBorder}>Engine</TableCell>
              <TableCell>New entries</TableCell>
              <TableCell align="right">Lots</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {books.map(book => {
              const st = statuses.find(s => s.instrument === book.instrument)
              const qty = st?.netQty ?? 0
              const flat = qty === 0
              const notice = rowNotice[book.instrument]
              const diff = chaseConfigDiffFields(book, primary)
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
                  <ConfigValueCell
                    field="emaPeriod"
                    differs={diff.has("emaPeriod")}
                    primaryLabel={primaryLabel}
                    firstInGroup
                  >
                    {book.emaPeriod}
                  </ConfigValueCell>
                  <ConfigValueCell
                    field="bufferPercent"
                    differs={diff.has("bufferPercent")}
                    primaryLabel={primaryLabel}
                  >
                    {book.bufferPercent}
                  </ConfigValueCell>
                  <ConfigValueCell
                    field="marketProtectionPercent"
                    differs={diff.has("marketProtectionPercent")}
                    primaryLabel={primaryLabel}
                  >
                    {book.marketProtectionPercent}
                  </ConfigValueCell>
                  <ConfigValueCell
                    field="entryLimitOffset"
                    differs={diff.has("entryLimitOffset")}
                    primaryLabel={primaryLabel}
                  >
                    {book.entryLimitOffset}
                  </ConfigValueCell>
                  <ConfigValueCell
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
                  <TableCell sx={groupBorder}>{st?.current ?? "—"}</TableCell>
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
                  <TableCell onClick={e => e.stopPropagation()} sx={groupBorder}>
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
                  <TableCell
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
      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
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
