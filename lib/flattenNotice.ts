export type FlattenOpenResult = {
  flattened: Array<{ positionId: string; tradingsymbol: string; qty: number; side: string }>
  skipped: Array<{ positionId?: string; tradingsymbol?: string; reason: string }>
  abortedJobs: string[]
  chaseReset: string[]
}

/** Live regular-market flatten is refused outside the session. The stop is not cancelled. */
export const LIVE_FLATTEN_MARKET_CLOSED =
  "Market is closed. The position and its stop were left unchanged."

export function liveFlattenSessionBlock(input: {
  paperBook: boolean
  marketOpen: boolean
}): string | null {
  if (input.paperBook || input.marketOpen) return null
  return LIVE_FLATTEN_MARKET_CLOSED
}

export function flattenOperatorNotice(
  result: FlattenOpenResult,
  whenDone: string
): { severity: "success" | "error"; text: string } {
  const blocked = result.skipped.some(row => row.reason === LIVE_FLATTEN_MARKET_CLOSED)
  if (blocked && result.flattened.length === 0) {
    return {
      severity: "error",
      text: "Market is closed. Nothing was squared off. Open positions and their stops were left unchanged.",
    }
  }
  if (blocked) {
    return {
      severity: "error",
      text: "Market is closed. Live books were left open with their stops. Paper books that were open have been squared off.",
    }
  }
  const failed = result.skipped.filter(row => row.reason && row.reason !== "already flat")
  if (result.flattened.length === 0 && failed.length > 0) {
    return { severity: "error", text: failed.map(row => row.reason).join("; ") }
  }
  return { severity: "success", text: whenDone }
}
