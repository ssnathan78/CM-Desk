import { Alert, Box, Link as MuiLink, Skeleton, Typography } from "@mui/material"
import Link from "next/link"

import { useDeskStatus } from "../../lib/hooks/useDeskStatus"
import { deriveStrategyDeskLine } from "../../lib/ui/deskStatus"

type Props = {
  strategyKey: "MOMENTUM" | "DAILY_TREND"
  engineOn: boolean
  pageExecutionLabel: string
  extra?: string
}

export function StrategyPermissionLine({
  strategyKey,
  engineOn,
  pageExecutionLabel,
  extra,
}: Props) {
  const { data, isLoading } = useDeskStatus(true)
  if (isLoading && !data) {
    return <Skeleton variant="text" width="80%" height={24} />
  }
  if (!data) return null
  const desk = deriveStrategyDeskLine(data.strategies[strategyKey])
  const book = data.strategies[strategyKey].executionMode

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Engine {engineOn ? "on" : "off"} · Desk: {desk.label} · Book: {book} · Page execution:{" "}
        {pageExecutionLabel}
        {extra ? ` · ${extra}` : ""}
      </Typography>
      {engineOn && !data.strategies[strategyKey].enabled ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Engine is on, but this strategy is disabled on{" "}
          <MuiLink component={Link} href="/risk">
            Risk
          </MuiLink>
          , so no order will be accepted.
        </Alert>
      ) : null}
    </Box>
  )
}
