import AccountStrip from "../AccountStrip"
import EmergencyPanel from "../EmergencyPanel"
import GoLiveReadinessPanel from "../GoLiveReadinessPanel"
import StrategyBoard from "../StrategyBoard"
import TodayJobs from "../TodayJobs"

type Portfolio = {
  availableCash?: string | number | null
  portfolioValue?: string | number | null
  grossExposure?: string | number | null
  drawdown?: string | number | null
  realizedPnl?: string | number | null
  unrealizedPnl?: string | number | null
}

type TodayRow = {
  id: string
  label: string
  open: number
  closedToday: string
  openMark: string
}
type RealizedRow = { id: string; label: string; realized: string }

export default function NowView({
  todayRows,
  realizedRows,
  portfolio,
  onChaseSquareOff,
  onEmergencyDone,
}: {
  todayRows: TodayRow[]
  realizedRows: RealizedRow[]
  portfolio?: Portfolio | null
  onChaseSquareOff: () => void
  onEmergencyDone: () => Promise<void>
}) {
  return (
    <>
      <StrategyBoard
        todayRows={todayRows}
        realizedRows={realizedRows}
        onChaseSquareOff={onChaseSquareOff}
      />
      <GoLiveReadinessPanel />
      <TodayJobs />
      <EmergencyPanel onDone={onEmergencyDone} />
      <AccountStrip portfolio={portfolio} />
    </>
  )
}
