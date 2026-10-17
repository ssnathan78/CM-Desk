import { Box, Button, Stack, Typography } from "@mui/material"
import type { ReactNode } from "react"

import ActionButton from "../lib/ActionButton"

export default function FormShell({
  footerLeft,
  onDiscard,
  onSave,
  saveLabel = "Save",
  saving,
  runNow,
  onCancel,
  children,
}: {
  footerLeft?: ReactNode
  onDiscard?: () => void
  onSave?: () => void
  saveLabel?: string
  saving?: boolean
  runNow?: () => void
  onCancel?: () => void
  children: ReactNode
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 320 }}>
      <Box sx={{ flex: 1, overflow: "auto", pb: 2 }}>{children}</Box>
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          py: 1.5,
          px: { xs: 0, sm: 1 },
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{footerLeft}</Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            {runNow ? (
              <ActionButton actionVariant="order" onClick={runNow}>
                Run now…
              </ActionButton>
            ) : null}
            {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
            {onDiscard ? (
              <Button onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
            ) : null}
            {onSave ? (
              <ActionButton actionVariant="save" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : saveLabel}
              </ActionButton>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export function FooterMessage({
  tone,
  children,
}: {
  tone: "attention" | "danger"
  children: ReactNode
}) {
  return (
    <Typography variant="body2" color={tone === "danger" ? "error" : "warning.main"}>
      {children}
    </Typography>
  )
}
