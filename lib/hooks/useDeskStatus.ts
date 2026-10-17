import useSWR from "swr"

import type { DeskStatusPayload } from "../ui/deskStatus"

export type DeskStatusResponse = DeskStatusPayload & {
  serverTimeIst: string
  alerts: { errorCount: number; warnCount: number }
}

export function useDeskStatus(enabled = true) {
  return useSWR<DeskStatusResponse>(enabled ? "/api/desk/status" : null, {
    refreshInterval: 10_000,
    revalidateOnFocus: true,
  })
}
