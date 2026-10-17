/**
 * Server-side confirmation phrases for actions that change a live book or arm live sending.
 * The desk dialog sends the phrase. The API rejects the action when the phrase is absent.
 */

export const SQUARE_OFF_CONFIRM = "SQUARE OFF"
export const KILL_INTRADAY_CONFIRM = "KILL INTRADAY"
export const KILL_ALL_CONFIRM = "KILL ALL"
export const ALLOW_LIVE_CONFIRM = "ALLOW LIVE"
export const ATTRIBUTE_FILL_CONFIRM = "ATTRIBUTE"

export function confirmationError(expected: string): string {
  return `Type ${expected} to confirm.`
}

export function confirmed(given: unknown, expected: string): boolean {
  return given === expected
}

/** Allow live orders can turn on only with the phrase. Turning it off needs no phrase. */
export function allowLiveArm(input: {
  current: boolean
  requested: boolean | undefined
  confirm: unknown
}): { ok: true } | { ok: false; error: string } {
  if (input.requested !== true || input.current) return { ok: true }
  if (!confirmed(input.confirm, ALLOW_LIVE_CONFIRM)) {
    return { ok: false, error: confirmationError(ALLOW_LIVE_CONFIRM) }
  }
  return { ok: true }
}

export function killConfirmPhrase(scope: "intraday" | "all"): string {
  return scope === "all" ? KILL_ALL_CONFIRM : KILL_INTRADAY_CONFIRM
}
