import { Box, TableContainer } from "@mui/material"
import type { ReactNode } from "react"

type ScrollTableProps = {
  children: ReactNode
  minWidth?: number
  maxHeight?: number | string
}

/** Horizontal scroll wrapper for wide tables. Page scrolls vertically — no jump controls. */
export default function ScrollTable({
  children,
  minWidth = 640,
  maxHeight,
}: ScrollTableProps) {
  return (
    <TableContainer
      sx={{
        overflow: "auto",
        maxWidth: "100%",
        maxHeight,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Box sx={{ minWidth }}>{children}</Box>
    </TableContainer>
  )
}
