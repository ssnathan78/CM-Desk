import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import { IconButton, Menu, MenuItem } from "@mui/material"
import { useState } from "react"

export default function BooksToolbarMenu({ onClearPaper }: { onClearPaper: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton
        size="small"
        aria-label="Books maintenance"
        onClick={e => setAnchor(e.currentTarget)}
        sx={{ ml: "auto" }}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onClearPaper()
          }}
        >
          Maintenance ▸ Clear paper book…
        </MenuItem>
      </Menu>
    </>
  )
}
