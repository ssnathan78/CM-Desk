import { Box, Typography } from "@mui/material"

import { labelFor } from "../../lib/ui/labels"
export default function TemplateSummary({
  state,
  dirtyKeys,
}: {
  state: Record<string, unknown>
  dirtyKeys?: Set<string>
}) {
  const mark = (key: string, text: string) =>
    dirtyKeys?.has(key) ? (
      <Box
        component="span"
        sx={{ textDecoration: "underline", textDecorationColor: "warning.main" }}
      >
        {text}
      </Box>
    ) : (
      text
    )

  const parts = [
    mark("instrument", labelFor(String(state.instrument ?? ""))),
    mark("strategy", labelFor(String(state.strategy ?? ""))),
    state.volatilityType ? mark("volatilityType", labelFor(String(state.volatilityType))) : null,
    state.product ? mark("product", labelFor(String(state.product))) : null,
    `${state.lots ?? "—"} lots`,
    state.stopLossPercent != null ? `SL ${state.stopLossPercent}%` : null,
    state.targetPnL != null ? `Target ${state.targetPnL} pts` : null,
    state.runAt ? `Runs ${String(state.runAt).slice(11, 16)}` : null,
  ].filter(Boolean)

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        py: 1,
        mb: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {parts.join(" · ")}
      </Typography>
    </Box>
  )
}
