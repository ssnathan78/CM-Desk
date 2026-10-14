import { Box, TableContainer } from "@mui/material"
import type { ReactNode } from "react"

type ScrollTableProps = {
  children: ReactNode
  minWidth?: number
  maxHeight?: number | string
}

export default function ScrollTable({ children, minWidth = 640, maxHeight }: ScrollTableProps) {
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
