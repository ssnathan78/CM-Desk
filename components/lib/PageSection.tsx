import { Box, Paper, Stack, Typography } from "@mui/material"
import type { ReactNode } from "react"

type PageSectionProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  /** Table sections: no side padding on content, optional top pad only. */
  flush?: boolean
}

/**
 * Outlined block with a header band so strategy pages read as separate panels, not one long form.
 */
export default function PageSection({
  title,
  description,
  actions,
  children,
  flush = false,
}: PageSectionProps) {
  return (
    <Paper
      variant="outlined"
      sx={theme => ({
        borderColor: "divider",
        bgcolor:
          theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.03)" : theme.palette.grey[50],
        overflow: "hidden",
      })}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              {title}
            </Typography>
            {description ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.25 }}
              >
                {description}
              </Typography>
            ) : null}
          </Box>
          {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
        </Stack>
      </Box>
      <Box sx={flush ? { pt: 1.5, pb: 0, px: 0 } : { p: 2 }}>{children}</Box>
    </Paper>
  )
}
