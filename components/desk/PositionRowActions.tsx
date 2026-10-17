import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import { Box, IconButton, Menu, MenuItem } from "@mui/material"
import type { MouseEvent } from "react"
import { useState } from "react"

import ActionButton from "../lib/ActionButton"

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

export default function PositionRowActions({
  symbol,
  qty,
  onSquareOff,
  onClearPhantom,
}: {
  symbol: string
  qty: number
  onSquareOff: () => void
  onClearPhantom: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <Box
      component="span"
      onClick={stopRowClick}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
    >
      <ActionButton
        size="small"
        actionVariant="order"
        onClick={e => {
          stopRowClick(e)
          onSquareOff()
        }}
        aria-label={`Square off ${symbol}`}
      >
        Square off {qty}…
      </ActionButton>
      <IconButton
        size="small"
        aria-label={`More actions for ${symbol}`}
        onClick={e => {
          stopRowClick(e)
          setAnchor(e.currentTarget)
        }}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          root: { onClick: stopRowClick },
          list: { onClick: stopRowClick },
        }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onClearPhantom()
          }}
        >
          Clear phantom row…
        </MenuItem>
      </Menu>
    </Box>
  )
}
