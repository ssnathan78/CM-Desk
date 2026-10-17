import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import { IconButton, Menu, MenuItem } from "@mui/material"
import { useState } from "react"

import ActionButton from "../lib/ActionButton"

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
    <>
      <ActionButton
        size="small"
        actionVariant="order"
        onClick={onSquareOff}
        aria-label={`Square off ${symbol}`}
      >
        Square off {qty}…
      </ActionButton>
      <IconButton
        size="small"
        aria-label={`More actions for ${symbol}`}
        onClick={e => setAnchor(e.currentTarget)}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onClearPhantom()
          }}
        >
          Clear phantom row…
        </MenuItem>
      </Menu>
    </>
  )
}
