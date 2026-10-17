import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward"
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward"
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined"
import {
  Box,
  Checkbox,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material"
import { useState } from "react"

import type { ColumnDef } from "../../lib/ui/columnVisibility"
import {
  optionalColumnsForMenu,
  reorderVisibleColumn,
  toggleVisibleColumn,
} from "../../lib/ui/columnVisibility"

export default function TableColumnMenu<T extends string>({
  columns,
  visible,
  onChange,
  ariaLabel = "Choose columns",
}: {
  columns: ColumnDef<T>[]
  visible: T[]
  onChange: (visible: T[]) => void
  ariaLabel?: string
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const optional = columns.filter(col => !col.locked)
  const menuColumns = optionalColumnsForMenu(columns, visible)

  if (!optional.length) return null

  return (
    <>
      <Tooltip title="Columns">
        <IconButton
          size="small"
          aria-label={ariaLabel}
          onClick={e => setAnchor(e.currentTarget)}
        >
          <ViewColumnOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 420 } } }}
      >
        <MenuItem disabled dense>
          <Typography variant="caption" color="text.secondary">
            Show · ↑↓ reorder visible
          </Typography>
        </MenuItem>
        {menuColumns.map(col => {
          const checked = visible.includes(col.id)
          const canMoveUp = checked && reorderVisibleColumn(visible, col.id, -1, columns) !== visible
          const canMoveDown =
            checked && reorderVisibleColumn(visible, col.id, 1, columns) !== visible
          return (
            <MenuItem
              key={col.id}
              dense
              onClick={() => onChange(toggleVisibleColumn(visible, col.id, columns))}
            >
              <Checkbox size="small" checked={checked} tabIndex={-1} />
              <ListItemText primary={col.label} />
              {checked ? (
                <Box sx={{ display: "flex", ml: 0.5 }} onClick={e => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    aria-label={`Move ${col.label} up`}
                    disabled={!canMoveUp}
                    onClick={() => onChange(reorderVisibleColumn(visible, col.id, -1, columns))}
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Move ${col.label} down`}
                    disabled={!canMoveDown}
                    onClick={() => onChange(reorderVisibleColumn(visible, col.id, 1, columns))}
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ) : null}
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}
