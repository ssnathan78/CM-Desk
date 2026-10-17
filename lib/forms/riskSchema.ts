import { z } from "zod"

import type { RISK_STRATEGY_KEYS, RiskSettings } from "../trading/riskEngine"

export const strategyRiskLimitsSchema = z.object({
  enabled: z.boolean(),
  halted: z.boolean(),
  haltReason: z.string().nullable(),
  executionMode: z.enum(["PAPER", "LIVE"]),
  maxLots: z.number().finite().min(0),
  maxOpenPositions: z.number().finite().min(0),
})

export const riskSettingsSchema = z.object({
  tradingEnabled: z.boolean(),
  deskHalted: z.boolean(),
  haltReason: z.string().nullable(),
  allowLiveOrders: z.boolean(),
  maxQtyPerOrder: z.number().finite().min(0),
  maxNotionalInr: z.number().finite().min(0),
  maxOpenOrders: z.number().finite().min(0),
  maxOrdersPerMinute: z.number().finite().min(0),
  stalePriceMaxAgeSec: z.number().finite().min(0),
  requireMarketHours: z.boolean(),
  minLtp: z.number().finite().min(0),
  strategies: z.object({
    ATM_STRADDLE: strategyRiskLimitsSchema,
    ATM_STRANGLE: strategyRiskLimitsSchema,
    CHASE: strategyRiskLimitsSchema,
    MOMENTUM: strategyRiskLimitsSchema,
    DAILY_TREND: strategyRiskLimitsSchema,
  }),
})

export type RiskFormValues = z.infer<typeof riskSettingsSchema>

export function toRiskFormValues(settings: RiskSettings): RiskFormValues {
  return {
    tradingEnabled: settings.tradingEnabled,
    deskHalted: settings.deskHalted,
    haltReason: settings.haltReason,
    allowLiveOrders: settings.allowLiveOrders,
    maxQtyPerOrder: settings.maxQtyPerOrder,
    maxNotionalInr: settings.maxNotionalInr,
    maxOpenOrders: settings.maxOpenOrders,
    maxOrdersPerMinute: settings.maxOrdersPerMinute,
    stalePriceMaxAgeSec: settings.stalePriceMaxAgeSec,
    requireMarketHours: settings.requireMarketHours,
    minLtp: settings.minLtp,
    strategies: { ...settings.strategies },
  }
}

/** Count leaf dirty fields from react-hook-form `dirtyFields`. */
export function countDirtyFields(dirty: unknown): number {
  let n = 0
  const walk = (node: unknown) => {
    if (node === true) {
      n += 1
      return
    }
    if (node && typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) walk(value)
    }
  }
  walk(dirty)
  return n
}

export const STRATEGY_ROW_LABEL: Record<(typeof RISK_STRATEGY_KEYS)[number], string> = {
  ATM_STRADDLE: "ATM straddle",
  ATM_STRANGLE: "ATM strangle",
  CHASE: "Chase",
  MOMENTUM: "Momentum",
  DAILY_TREND: "Daily trend",
}

export const HIDE_MAX_LOTS: Record<(typeof RISK_STRATEGY_KEYS)[number], boolean> = {
  ATM_STRADDLE: false,
  ATM_STRANGLE: false,
  CHASE: false,
  MOMENTUM: true,
  DAILY_TREND: true,
}
