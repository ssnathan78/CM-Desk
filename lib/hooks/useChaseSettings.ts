import useSWR from "swr"
import type { ChaseBookConfig, ChaseEngineConfig } from "../chaseDefaults"
import fetchJson from "../fetchJson"
import type { SetupNotionalRow } from "../trading/setupNotional"

type ChaseSettingsResponse = {
  config: ChaseEngineConfig
  books?: ChaseBookConfig[]
  notional?: {
    maxNotionalInr: number
    rows: SetupNotionalRow[]
  }
}

export function useChaseSettings() {
  return useSWR<ChaseSettingsResponse>("/api/chase-settings", fetchJson)
}
