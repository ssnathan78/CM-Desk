import { Button, Menu, MenuItem, Typography } from "@mui/material"
import { useState } from "react"

import { feedClearMenuCopy } from "../../lib/operatorActionCopy"
import type { FeedPeriod } from "../../lib/trading/feedWindow"

export default function FeedClearMenu({
  kind,
  onClear,
}: {
  kind: "alerts" | "signals"
  onClear: (period: FeedPeriod) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const copy = feedClearMenuCopy(kind)
  return (
    <>
      <Button
        size="small"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-label={copy.button}
        onClick={e => setAnchor(e.currentTarget)}
      >
        {copy.button}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem disabled sx={{ opacity: 1, whiteSpace: "normal", maxWidth: 280 }}>
          <Typography variant="caption" color="text.secondary">
            {copy.note}
          </Typography>
        </MenuItem>
        {copy.items.map(item => (
          <MenuItem
            key={item.period}
            onClick={() => {
              setAnchor(null)
              onClear(item.period)
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
