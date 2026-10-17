import type { MarketSessionState } from "../marketCalendar"
import type { RiskStrategyKey } from "../trading/riskEngine"

export type DeskStatusPayload = {
  mockOrders: boolean
  allowLiveOrders: boolean
  tradingEnabled: boolean
  deskHalted: boolean
  haltReason: string | null
  market: { session: MarketSessionState; isTradingDay: boolean }
  strategies: Record<
    RiskStrategyKey,
    {
      enabled: boolean
      halted: boolean
      haltReason: string | null
      executionMode: "PAPER" | "LIVE"
      openPositions: number
    }
  >
}

export type ChipTone = "neutral" | "attention" | "danger" | "live" | "paper" | "mock"

export type ModeChip = { label: string; tone: ChipTone; tooltip: string }

export type EntriesChip = { label: string; tone: ChipTone }

const STRATEGY_LABEL: Record<RiskStrategyKey, string> = {
  ATM_STRADDLE: "ATM straddle",
  ATM_STRANGLE: "ATM strangle",
  CHASE: "Chase",
  MOMENTUM: "Momentum",
  DAILY_TREND: "Daily trend",
}

function strategyModeLines(status: DeskStatusPayload): string {
  return (Object.keys(status.strategies) as RiskStrategyKey[])
    .map(key => `${STRATEGY_LABEL[key]}: ${status.strategies[key].executionMode}`)
    .join("\n")
}

export function deriveModeChip(status: DeskStatusPayload): ModeChip {
  const modes = strategyModeLines(status)
  if (status.mockOrders) {
    return {
      label: "MOCK",
      tone: "mock",
      tooltip:
        "MOCK_ORDERS=true on this process. Nothing reaches Kite, whatever the Risk settings say.",
    }
  }
  if (!status.allowLiveOrders) {
    return {
      label: "PAPER ONLY",
      tone: "paper",
      tooltip: `Live orders are blocked at the desk.\n${modes}`,
    }
  }
  const live = (Object.keys(status.strategies) as RiskStrategyKey[]).filter(
    k => status.strategies[k].executionMode === "LIVE"
  )
  if (live.length) {
    const names = live.map(k => STRATEGY_LABEL[k]).join(", ")
    return {
      label: `LIVE · ${names}`,
      tone: "live",
      tooltip: modes,
    }
  }
  return {
    label: "LIVE ALLOWED · all strategies paper",
    tone: "paper",
    tooltip: modes,
  }
}

export function deriveEntriesChip(status: DeskStatusPayload): EntriesChip {
  if (status.deskHalted) {
    const reason = status.haltReason?.trim() || "New entries are stopped"
    return { label: `Halted: ${reason}`, tone: "danger" }
  }
  if (!status.tradingEnabled) {
    return { label: "Trading off", tone: "attention" }
  }
  return { label: "Entries allowed", tone: "neutral" }
}

export function deriveStrategyDeskLine(
  row: DeskStatusPayload["strategies"][RiskStrategyKey]
): { label: string; tone: ChipTone } {
  if (!row.enabled) {
    return { label: "Disabled — dark", tone: "danger" }
  }
  if (row.halted) {
    const reason = row.haltReason?.trim()
    return {
      label: reason ? `Entries paused: ${reason}` : "Entries paused",
      tone: "attention",
    }
  }
  return { label: "Enabled", tone: "neutral" }
}

export function marketSessionRailLabel(session: MarketSessionState): string {
  switch (session) {
    case "PRE_MARKET":
      return "Pre-open"
    case "OPEN":
      return "Open"
    case "POST_MARKET":
      return "Post-market"
    case "WEEKEND":
      return "Weekend"
    case "HOLIDAY":
      return "Holiday"
    case "OVERNIGHT":
      return "Overnight"
    case "HALTED":
      return "Halted"
    case "SUSPENDED":
      return "Suspended"
    default:
      return "Closed"
  }
}
