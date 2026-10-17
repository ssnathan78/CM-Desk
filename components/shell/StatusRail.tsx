import { Chip, Skeleton, Stack, Typography } from "@mui/material"
import Link from "next/link"
import { useEffect, useState } from "react"

import { formatIstTime } from "../../lib/format"
import { useDeskStatus } from "../../lib/hooks/useDeskStatus"
import { deriveEntriesChip, deriveModeChip, marketSessionRailLabel } from "../../lib/ui/deskStatus"
import { color } from "../../src/tokens"
import HaltControl from "./HaltControl"

type Props = {
  loggedIn: boolean
  compact?: boolean
  onRiskMutate?: () => void | Promise<void>
}

function chipStyles(tone: string) {
  switch (tone) {
    case "live":
      return { bgcolor: color.live.bg, color: color.live.fg, border: "none" }
    case "danger":
      return { borderColor: color.danger.main, color: color.danger.text }
    case "attention":
      return { borderColor: color.attention.main, color: color.attention.main }
    case "mock":
      return { borderColor: color.attention.main, color: color.attention.main }
    default:
      return { borderColor: color.border.default, color: color.text.secondary }
  }
}

export default function StatusRail({ loggedIn, compact, onRiskMutate }: Props) {
  const { data, error, mutate, isLoading } = useDeskStatus(loggedIn)
  const [clockSkewMs, setClockSkewMs] = useState(0)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!data?.serverTimeIst) return
    const server = new Date(data.serverTimeIst).getTime()
    setClockSkewMs(server - Date.now())
  }, [data?.serverTimeIst])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!loggedIn) return null

  if (isLoading && !data) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Skeleton variant="rounded" width={96} height={28} />
        <Skeleton variant="rounded" width={120} height={28} />
      </Stack>
    )
  }

  if (error || !data) {
    return (
      <Chip
        size="small"
        label="Status unavailable"
        color="error"
        onClick={() => mutate()}
        sx={{ cursor: "pointer" }}
      />
    )
  }

  const mode = deriveModeChip(data)
  const entries = deriveEntriesChip(data)
  const alertTotal = data.alerts.errorCount + data.alerts.warnCount
  const now = new Date(Date.now() + clockSkewMs)
  const sessionLabel = marketSessionRailLabel(data.market.session)

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", flex: 1 }}
    >
      <TooltipChip label={mode.label} title={mode.tooltip} sx={chipStyles(mode.tone)} />
      <Chip
        size="small"
        component={Link}
        href="/risk"
        clickable
        label={entries.label}
        variant="outlined"
        sx={chipStyles(entries.tone)}
      />
      {!compact ? (
        <Chip
          size="small"
          component={Link}
          href="/desk?tab=alerts"
          clickable
          label={alertTotal ? `Alerts ${alertTotal}` : "No alerts"}
          variant="outlined"
          color={data.alerts.errorCount ? "error" : data.alerts.warnCount ? "warning" : "default"}
        />
      ) : null}
      {!compact ? (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {formatIstTime(now)} IST · {sessionLabel}
        </Typography>
      ) : null}
      <HaltControl
        deskHalted={data.deskHalted}
        haltReason={data.haltReason}
        compact={compact}
        onChanged={async () => {
          await mutate()
          await onRiskMutate?.()
        }}
      />
    </Stack>
  )
}

function TooltipChip({
  label,
  title,
  sx,
}: {
  label: string
  title: string
  sx: Record<string, unknown>
}) {
  return (
    <Chip
      size="small"
      label={label}
      title={title}
      variant="outlined"
      sx={{ maxWidth: 280, ...sx }}
    />
  )
}
