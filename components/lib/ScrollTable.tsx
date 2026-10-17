import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import { Box, Button, Stack, TableContainer } from "@mui/material"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

type ScrollTableProps = {
  children: ReactNode
  minWidth?: number
  maxHeight?: number | string
  /** Sticky jump buttons above the table when content overflows horizontally. */
  scrollControls?: boolean
  scrollStartLabel?: string
  scrollEndLabel?: string
}

export default function ScrollTable({
  children,
  minWidth = 640,
  maxHeight,
  scrollControls = false,
  scrollStartLabel = "Earlier columns",
  scrollEndLabel = "Later columns",
}: ScrollTableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false, overflow: false })

  const updateEdges = useCallback(() => {
    const el = ref.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const overflow = maxScroll > 4
    setEdges({
      left: overflow && el.scrollLeft > 4,
      right: overflow && el.scrollLeft < maxScroll - 4,
      overflow,
    })
  }, [])

  useEffect(() => {
    updateEdges()
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateEdges])

  const scrollToStart = () => ref.current?.scrollTo({ left: 0, behavior: "smooth" })
  const scrollToEnd = () => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: "smooth" })
  }

  const showBar = scrollControls && edges.overflow

  return (
    <Box>
      {scrollControls ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            mb: 0.5,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 0.5,
            minHeight: showBar ? 32 : 0,
            visibility: showBar ? "visible" : "hidden",
          }}
        >
          {edges.left ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChevronLeftIcon />}
              onClick={scrollToStart}
            >
              {scrollStartLabel}
            </Button>
          ) : null}
          {edges.right ? (
            <Button
              size="small"
              variant="outlined"
              endIcon={<ChevronRightIcon />}
              onClick={scrollToEnd}
            >
              {scrollEndLabel}
            </Button>
          ) : null}
        </Stack>
      ) : null}
      <TableContainer
        ref={ref}
        onScroll={updateEdges}
        sx={{
          overflow: "auto",
          maxWidth: "100%",
          maxHeight,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Box sx={{ minWidth }}>{children}</Box>
      </TableContainer>
    </Box>
  )
}
