export function killOperatorNotice(input: {
  scope: "intraday" | "all"
  liveLeftOpen: boolean
  chasePaused: boolean
  deskHalted: boolean
}): { severity: "success" | "error"; text: string } | null {
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

/** Kill is not done until the halt row is stored. A pause failure is reported on its own. */
export function killResponseStatus(deskHalted: boolean): 200 | 500 {
  return deskHalted ? 200 : 500
}
