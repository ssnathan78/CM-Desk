export function killOperatorNotice(input: {
  scope: "intraday" | "all"
  liveLeftOpen: boolean
  chasePaused: boolean
  deskHalted: boolean
  flattenFailed?: boolean
}): { severity: "success" | "error"; text: string } | null {
  if (input.flattenFailed) {
    const halt = input.deskHalted
      ? "The desk is halted."
      : "The desk halt was not saved. New entries are not blocked."
    const pause =
      input.scope === "all"
        ? input.chasePaused
          ? " Chase is paused."
          : " Chase was not paused."
        : " Chase was not paused."
    return {
      severity: "error",
      text: `Flatten did not run. Open books were left as they were. ${halt}${pause}`,
    }
  }
  if (!input.deskHalted) {
    return {
      severity: "error",
      text: "The desk halt was not saved. New entries are not blocked. Check Desk → Risk.",
    }
  }
  if (input.scope === "all" && !input.chasePaused) {
    const closed = input.liveLeftOpen
      ? "Market is closed. Live books were left open with their stops. "
      : ""
    return {
      severity: "error",
      text: `${closed}The desk is halted. Chase was not paused — the next signal can still enter.`,
    }
  }
  if (input.liveLeftOpen) {
    return {
      severity: "error",
      text:
        input.scope === "all"
          ? "Market is closed. Live books were left open with their stops. Chase is paused and the desk is halted."
          : "Market is closed. Live intraday books were left open with their stops. The desk is halted. Chase was not paused.",
    }
  }
  return null
}

/** Always has text, so the Kill dialog can stay open on both success and failure. */
export function killDialogNotice(input: Parameters<typeof killOperatorNotice>[0]): {
  severity: "success" | "error"
  text: string
} {
  const problem = killOperatorNotice(input)
  if (problem) return problem
  if (input.scope === "all") {
    return {
      severity: "success",
      text: "Kill finished. Open books that could be flattened were flattened. Chase is paused. The desk is halted.",
    }
  }
  return {
    severity: "success",
    text: "Kill finished. Today's straddles and strangles that could be flattened were flattened. Chase was not paused. The desk is halted.",
  }
}

/** Kill is not done until the halt row is stored. A pause failure is reported on its own. */
export function killResponseStatus(deskHalted: boolean): 200 | 500 {
  return deskHalted ? 200 : 500
}
