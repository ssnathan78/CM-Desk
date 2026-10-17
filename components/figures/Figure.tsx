import type { SxProps, Theme } from "@mui/material/styles"
import Typography from "@mui/material/Typography"

import {
  formatInr,
  formatPct,
  formatPrice,
  formatPts,
  formatQty,
  type PnlTone,
  pnlColorSx,
  pnlTone,
} from "../../lib/format"

export type FigureKind = "inr" | "pts" | "qty" | "price" | "pct" | "plain"

type Props = {
  kind: FigureKind
  value: string | number | null | undefined
  pnl?: boolean
  signed?: boolean
  flat?: boolean
  size?: "default" | "lg"
  align?: "left" | "right"
  sx?: SxProps<Theme>
}

function ariaForPnl(value: string | number | null | undefined, tone: PnlTone): string | undefined {
  if (!tone || tone === "none" || tone === "zero") return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) return undefined
  const dir = tone === "profit" ? "profit" : "loss"
  return `${dir} ${Math.abs(n).toFixed(2)} rupees`
}

export default function Figure({
  kind,
  value,
  pnl = false,
  signed = false,
  flat = false,
  size = "default",
  align = "right",
  sx,
}: Props) {
  let text: string
  switch (kind) {
    case "inr":
      text = formatInr(value, { sign: pnl })
      break
    case "pts":
      text = formatPts(value, { sign: pnl })
      break
    case "qty":
      text = formatQty(value, { signed })
      break
    case "price":
      text = formatPrice(value, { flat })
      break
    case "pct":
      text = formatPct(value)
      break
    default:
      text = value == null || value === "" ? "—" : String(value)
  }

  const tone = pnl ? pnlTone(value) : "none"
  const color = pnl ? pnlColorSx(tone) : "text.primary"

  return (
    <Typography
      component="span"
      variant={size === "lg" ? "figureLg" : "figure"}
      sx={{ display: "block", textAlign: align, color, ...sx }}
      aria-label={pnl ? ariaForPnl(value, tone) : undefined}
    >
      {text}
    </Typography>
  )
}
