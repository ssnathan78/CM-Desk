import { Paper, Tab, Tabs, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material"

import { type DeskTab, type DeskView, tabsForView } from "../../lib/deskNavigation"

const VIEW_LABELS: Record<DeskView, string> = {
  now: "Now",
  books: "Books",
  why: "Why",
  setup: "Setup",
}

const TAB_LABELS: Record<DeskTab, string> = {
  today: "Today",
  positions: "Positions",
  orders: "Orders",
  trades: "Trades",
  sessions: "Sessions",
  alerts: "Alerts",
  signals: "Signals",
  decisions: "Decisions",
  activity: "Activity",
  lists: "Lists",
  contracts: "Contracts",
  broker: "Broker",
  maintenance: "Maintenance",
}

export default function DeskViewChrome({
  view,
  tab,
  alertBadge,
  signalBadge,
  onView,
  onTab,
}: {
  view: DeskView
  tab: DeskTab
  alertBadge?: number
  signalBadge?: number
  onView: (view: DeskView) => void
  onTab: (tab: DeskTab) => void
}) {
  const subTabs = tabsForView(view)
  return (
    <Paper
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { md: "center" },
        gap: 1,
        px: 1,
        py: 0.5,
        minHeight: 44,
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={view}
        onChange={(_, next) => {
          if (next) onView(next as DeskView)
        }}
        aria-label="Desk view"
      >
        {(Object.keys(VIEW_LABELS) as DeskView[]).map(key => (
          <ToggleButton key={key} value={key} sx={{ textTransform: "none", py: 0.5 }}>
            {VIEW_LABELS[key]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Tabs
        value={subTabs.indexOf(tab)}
        onChange={(_, index) => onTab(subTabs[index] ?? subTabs[0])}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ minHeight: 40, flex: 1 }}
      >
        {subTabs.map(t => {
          let label = TAB_LABELS[t]
          if (t === "alerts" && alertBadge) label = `Alerts (${alertBadge})`
          if (t === "signals" && signalBadge) label = `Signals (${signalBadge})`
          return <Tab key={t} label={label} sx={{ minHeight: 40, py: 0.5 }} />
        })}
      </Tabs>
      {view === "now" && tab === "today" ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: "none", lg: "block" }, pr: 1 }}
        >
          Strategy board · jobs · emergency
        </Typography>
      ) : null}
    </Paper>
  )
}
