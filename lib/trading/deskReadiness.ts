import { STRATEGY_ROW_LABEL } from "../forms/riskSchema"
import { labelFor } from "../ui/labels"
import type { RiskStrategyKey } from "./riskEngine"
import { RISK_STRATEGY_KEYS } from "./riskEngine"

export type ReadinessSeverity = "error" | "warning" | "info"

export type ReadinessBlocker = {
  id: string
  label: string
  severity: ReadinessSeverity
  href: string
}

export type DeskReadinessInput = {
  mockOrders: boolean
  allowLiveOrders: boolean
  tradingEnabled: boolean
  deskHalted: boolean
  haltReason: string | null
  kiteSessionOk: boolean
  strategies: Record<
    RiskStrategyKey,
    {
      enabled: boolean
      halted: boolean
      executionMode: "PAPER" | "LIVE"
      openPositions: number
    }
  >
  paperOpenPositions: number
  liveOpenPositions: number
  marketSession: string
  requireMarketHours?: boolean
}

export type DeskReadiness = {
  ready: boolean
  blockers: ReadinessBlocker[]
}

export function evaluateDeskReadiness(input: DeskReadinessInput): DeskReadiness {
  const blockers: ReadinessBlocker[] = []

  if (input.mockOrders) {
    blockers.push({
      id: "mock_orders",
      label: "MOCK_ORDERS is on — Kite will not receive orders until deployment turns it off.",
      severity: "error",
      href: "/help/desk#go-live",
    })
  }
  if (!input.kiteSessionOk) {
    blockers.push({
      id: "kite_session",
      label: "Zerodha session is missing or expired — log in again.",
      severity: "error",
      href: "/",
    })
  }
  if (!input.allowLiveOrders) {
    blockers.push({
      id: "allow_live",
      label: "Allow live orders is off on Desk → Risk.",
      severity: "error",
      href: "/risk",
    })
  }
  if (input.deskHalted) {
    blockers.push({
      id: "desk_halted",
      label: input.haltReason
        ? `Desk halt is on: ${input.haltReason}`
        : "Desk halt is on — new entries are blocked.",
      severity: "error",
      href: "/desk?view=now&tab=today",
    })
  }
  if (!input.tradingEnabled) {
    blockers.push({
      id: "trading_disabled",
      label: "Trading enabled is off on Desk → Risk.",
      severity: "warning",
      href: "/risk",
    })
  }

  const liveStrategies = RISK_STRATEGY_KEYS.filter(
    k => input.strategies[k]?.executionMode === "LIVE"
  )
  if (liveStrategies.length === 0 && !input.mockOrders) {
    blockers.push({
      id: "no_live_strategy",
      label: "No strategy is set to Live execution on Desk → Risk.",
      severity: "info",
      href: "/risk",
    })
  }

  for (const key of liveStrategies) {
    const row = input.strategies[key]
    if (!row.enabled) {
      blockers.push({
        id: `disabled_${key}`,
        label: `${STRATEGY_ROW_LABEL[key]} is disabled on Risk.`,
        severity: "error",
        href: "/risk",
      })
    }
    if (row.halted) {
      blockers.push({
        id: `halted_${key}`,
        label: `${STRATEGY_ROW_LABEL[key]} is halted on Risk.`,
        severity: "warning",
        href: "/risk",
      })
    }
  }

  if (input.paperOpenPositions > 0 && liveStrategies.length > 0) {
    blockers.push({
      id: "paper_leftover",
      label: `${input.paperOpenPositions} open paper/mock position(s) — archive or square off before relying on a live book.`,
      severity: "warning",
      href: "/desk?view=books&tab=positions",
    })
  }

  if (
    input.requireMarketHours &&
    input.marketSession !== "OPEN" &&
    liveStrategies.length > 0 &&
    !input.mockOrders
  ) {
    blockers.push({
      id: "market_closed",
      label: `Market is ${labelFor(input.marketSession) || input.marketSession} — live entries may be rejected.`,
      severity: "info",
      href: "/risk",
    })
  }

  const ready = !blockers.some(b => b.severity === "error")
  return { ready, blockers }
}
