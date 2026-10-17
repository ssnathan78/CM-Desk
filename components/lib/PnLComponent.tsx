import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import { formatInrLabel, pnlTone } from "../../lib/format"
import Figure from "../figures/Figure"

type Props = {
  pnl?: number | null
  points?: number | null
}

export default function PnLComponent({ pnl, points }: Props) {
  const rupeeTone = typeof pnl === "number" ? pnlTone(pnl) : "none"
  const chipColor = rupeeTone === "loss" ? "error" : rupeeTone === "profit" ? "success" : "default"

  if (typeof pnl !== "number" && typeof points !== "number") {
    return <Chip size="small" label="P&L" />
  }

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
      {typeof pnl === "number" ? (
        <Chip
          size="small"
          label={formatInrLabel(pnl, { sign: true })}
          color={chipColor === "default" ? undefined : chipColor}
          sx={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}
        />
      ) : null}
      {typeof points === "number" ? <Figure kind="pts" value={points} pnl align="left" /> : null}
    </Box>
  )
}
