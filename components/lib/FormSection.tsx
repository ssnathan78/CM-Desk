import { Box, Link as MuiLink, Typography } from "@mui/material"
import NextLink from "next/link"
import type React from "react"

/** Template editor panel — matches PageSection header band, tuned for dense forms. */
export default function FormSection({
  title,
  hint,
  helpHref,
  children,
  span = false,
}: {
  title: string
  hint?: string
  helpHref?: string
  children: React.ReactNode
  span?: boolean
}) {
  return (
    <Box
      sx={theme => ({
        gridColumn: span ? "1 / -1" : "auto",
        minWidth: 0,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor:
          theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.03)" : theme.palette.grey[50],
      })}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </Typography>
          {helpHref ? (
            <MuiLink component={NextLink} href={helpHref} variant="caption">
              What is this?
            </MuiLink>
          ) : null}
        </Box>
        {hint ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {hint}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Box>
  )
}
