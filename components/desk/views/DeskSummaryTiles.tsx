import { Box, Typography } from "@mui/material"
import type { DeskTab, DeskView } from "../../../lib/deskNavigation"
import { formatInr } from "../../../lib/format"
import Figure from "../../figures/Figure"

const deskTileSx = {
  textAlign: "left" as const,
  font: "inherit",
  color: "inherit",
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
  borderRadius: 1,
  px: 1,
  py: 0.5,
  cursor: "pointer",
  minWidth: 0,
}

type TodayRow = { id: string; label: string; open: number; closedToday: string; openMark: string }
type RealizedRow = { id: string; label: string; realized: string }

export default function DeskSummaryTiles({
  todayRows,
  todayOpen,
  realizedRows,
  portfolio,
  onNavigate,
}: {
  todayRows: TodayRow[]
  todayOpen: number
  realizedRows: RealizedRow[]
  portfolio?: {
    availableCash?: string
    portfolioValue?: string
    realizedPnl?: string
    grossExposure?: string
    unrealizedPnl?: string
    drawdown?: string
  }
  onNavigate: (view: DeskView, tab: DeskTab) => void
}) {
  const p = portfolio
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.9fr 1.1fr" },
        gap: 1,
        mb: 1,
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => onNavigate("books", "sessions")}
        title="Closed is round-trips finished today. Mark is from the entry price, so an overnight Chase book includes earlier days."
        aria-label="Today by strategy. The number in parentheses is open books. Closed is round-trips finished today. Open mark is from the entry price."
        sx={deskTileSx}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            columnGap: 1,
            alignItems: "baseline",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Today · {todayOpen} open
          </Typography>
          <Typography variant="caption" color="text.secondary">
            closed
          </Typography>
          <Typography variant="caption" color="text.secondary">
            mark
          </Typography>
          {todayRows.map(row => (
            <Box key={row.id} sx={{ display: "contents" }}>
              <Typography variant="body2" noWrap>
                {row.label} ({row.open})
              </Typography>
              <Figure kind="inr" value={row.closedToday} pnl align="left" />
              <Figure kind="inr" value={row.openMark} pnl align="left" />
            </Box>
          ))}
        </Box>
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => onNavigate("books", "positions")}
        title="Realized already stored on the books. It is not today's closed column, and it is not Kite's day P&L."
        aria-label="Realized on the books by strategy. This is not today's closed round-trips."
        sx={deskTileSx}
      >
        <Typography variant="caption" color="text.secondary">
          Realized
        </Typography>
        {realizedRows.map(row => (
          <Box
            key={row.id}
            sx={{ display: "flex", justifyContent: "space-between", gap: 1, minWidth: 0 }}
          >
            <Typography variant="body2" noWrap>
              {row.label}
            </Typography>
            <Figure kind="inr" value={row.realized} pnl align="right" />
          </Box>
        ))}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => onNavigate("books", "positions")}
        title="Margin + open MTM is Kite available margin plus desk unrealized (average cost versus mark). It is not Kite equity and not Sessions net. Realized lifetime is stored on the position rows, not today's closed round-trips. Drawdown is the peak of that margin-plus-MTM figure minus the current one."
        aria-label={`Cash ${formatInr(p?.availableCash)}. Realized lifetime ${formatInr(p?.realizedPnl)}. Unrealized ${formatInr(p?.unrealizedPnl)}. Margin plus open mark ${formatInr(p?.portfolioValue)}. Gross exposure ${formatInr(p?.grossExposure)}. Drawdown ${formatInr(p?.drawdown)}.`}
        sx={{
          ...deskTileSx,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 1.5,
          rowGap: 0.25,
        }}
      >
        {(
          [
            ["Cash", formatInr(p?.availableCash)],
            ["Margin + open MTM", formatInr(p?.portfolioValue)],
            ["Realized lifetime", formatInr(p?.realizedPnl)],
            ["Gross exposure", formatInr(p?.grossExposure)],
            ["Unrealized", formatInr(p?.unrealizedPnl)],
            ["Drawdown", formatInr(p?.drawdown)],
          ] as const
        ).map(([label, value]) => (
          <Box
            key={label}
            sx={{ display: "flex", justifyContent: "space-between", gap: 0.5, minWidth: 0 }}
          >
            <Typography variant="caption" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
