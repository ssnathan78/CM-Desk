import { Box, Skeleton, Typography } from "@mui/material"
import useSWR from "swr"

type ChartPayload = {
  points: {
    at: string
    close: number
    ema: number | null
    upper: number | null
    lower: number | null
  }[]
  scale: { min: number; max: number }
}

const WIDTH = 360
const HEIGHT = 72

function yFor(value: number, min: number, max: number) {
  if (max === min) return HEIGHT / 2
  return HEIGHT - ((value - min) / (max - min)) * HEIGHT
}

function polyline(
  points: ChartPayload["points"],
  pick: (p: ChartPayload["points"][number]) => number | null,
  min: number,
  max: number
) {
  const coords: string[] = []
  points.forEach((point, index) => {
    const value = pick(point)
    if (value == null) return
    const x = (index / Math.max(1, points.length - 1)) * WIDTH
    coords.push(`${x},${yFor(value, min, max).toFixed(2)}`)
  })
  if (coords.length < 2) return ""
  return coords.join(" ")
}

export default function ChaseSparkChart({ instrument }: { instrument: string }) {
  const { data, error, isLoading } = useSWR<ChartPayload>(
    instrument ? `/api/chase-settings/chart?instrument=${encodeURIComponent(instrument)}` : null,
    { revalidateOnFocus: false }
  )

  if (isLoading) return <Skeleton variant="rounded" height={HEIGHT + 16} />
  if (error || !data?.points?.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        Hourly chart unavailable{error instanceof Error ? `: ${error.message}` : ""}.
      </Typography>
    )
  }

  const { min, max } = data.scale
  const closeLine = polyline(data.points, p => p.close, min, max)
  const emaLine = polyline(data.points, p => p.ema, min, max)
  const upperLine = polyline(data.points, p => p.upper, min, max)
  const lowerLine = polyline(data.points, p => p.lower, min, max)

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        Last {data.points.length} hourly bars · close vs EMA band
      </Typography>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Chase hourly spark chart for ${instrument}`}
      >
        {upperLine ? (
          <polyline
            fill="none"
            stroke="rgba(45, 212, 191, 0.35)"
            strokeWidth="1"
            points={upperLine}
          />
        ) : null}
        {lowerLine ? (
          <polyline
            fill="none"
            stroke="rgba(45, 212, 191, 0.35)"
            strokeWidth="1"
            points={lowerLine}
          />
        ) : null}
        {emaLine ? (
          <polyline
            fill="none"
            stroke="rgba(45, 212, 191, 0.9)"
            strokeWidth="1.5"
            points={emaLine}
          />
        ) : null}
        {closeLine ? (
          <polyline
            fill="none"
            stroke="rgba(148, 163, 184, 0.95)"
            strokeWidth="1.5"
            points={closeLine}
          />
        ) : null}
      </svg>
    </Box>
  )
}
