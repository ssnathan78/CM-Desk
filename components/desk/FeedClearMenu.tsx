import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import { IconButton, Menu, MenuItem } from "@mui/material"
import { useState } from "react"

import type { FeedPeriod } from "../../lib/trading/feedWindow"

export default function FeedClearMenu({
  label,
  onClear,
}: {
  label: string
  onClear: (period: FeedPeriod) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton size="small" aria-label={label} onClick={e => setAnchor(e.currentTarget)}>
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onClear("today")
          }}
        >
          Today…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onClear("before_today")
          }}
        >
          Before today…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onClear("all")
          }}
        >
          All…
        </MenuItem>
      </Menu>
    </>
  )
}
