import useSWR from "swr"
import type { ChaseBookConfig, ChaseEngineConfig } from "../chaseDefaults"
import fetchJson from "../fetchJson"
import type { SetupNotionalRow } from "../trading/setupNotional"

export type ChaseBookStatus = {
  instrument: string
  current: string | null
  tradingsymbol: string | null
  netQty: number
  openMark: string
}

type ChaseSettingsResponse = {
  config: ChaseEngineConfig
  books?: ChaseBookConfig[]
  statuses?: ChaseBookStatus[]
  notional?: {
    maxNotionalInr: number
    rows: SetupNotionalRow[]
    lotSizes?: Record<string, number>
  }
}

export function useChaseSettings() {
  return useSWR<ChaseSettingsResponse>("/api/chase-settings", fetchJson)
}
