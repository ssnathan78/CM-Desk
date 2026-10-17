import CloseIcon from "@mui/icons-material/Close"
import { Box, Drawer, IconButton, Typography } from "@mui/material"
import type { ReactNode } from "react"

export default function RecordDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = 420,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: width } } } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <IconButton aria-label="Close drawer" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ p: 2, overflow: "auto" }}>{children}</Box>
    </Drawer>
  )
}
