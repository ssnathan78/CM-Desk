import Chip from "@mui/material/Chip"
import { labelFor } from "../../lib/ui/labels"
import { color } from "../../src/tokens"

type Book = "LIVE" | "PAPER" | "MOCK" | "RECONCILED" | "MIGRATED"

export default function BookBadge({ book }: { book: Book | string | null | undefined }) {
  const key = String(book ?? "").toUpperCase()
  if (!key) return null
  const label = labelFor(key)
  const isLive = key === "LIVE"
  return (
    <Chip
      size="small"
      label={label}
      variant={isLive ? "filled" : "outlined"}
      sx={
        isLive
          ? { bgcolor: color.live.bg, color: color.live.fg, fontWeight: 600 }
          : { borderColor: color.paper.border, color: color.paper.fg, fontWeight: 600 }
      }
    />
  )
}
