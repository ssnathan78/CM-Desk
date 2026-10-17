import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material"

import { formatInr } from "../../lib/format"
import Figure from "../figures/Figure"

type Portfolio = {
  availableCash?: string | number | null
  portfolioValue?: string | number | null
  grossExposure?: string | number | null
  drawdown?: string | number | null
  realizedPnl?: string | number | null
  unrealizedPnl?: string | number | null
}

export default function AccountStrip({ portfolio }: { portfolio?: Portfolio | null }) {
  const pairs = [
    ["Cash", formatInr(portfolio?.availableCash)],
    ["Portfolio", formatInr(portfolio?.portfolioValue)],
    ["Gross exposure", formatInr(portfolio?.grossExposure)],
    ["Drawdown", formatInr(portfolio?.drawdown)],
    ["Realized", portfolio?.realizedPnl],
    ["Unrealized", portfolio?.unrealizedPnl],
  ] as const

  return (
    <Accordion disableGutters sx={{ bgcolor: "background.paper", mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Account</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            rowGap: 1,
          }}
        >
          {pairs.map(([label, value]) => (
            <Box key={label} sx={{ minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {label}
              </Typography>
              {label === "Realized" || label === "Unrealized" ? (
                <Figure kind="inr" value={value as string} pnl align="left" />
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {value}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
