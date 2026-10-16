/** Kite's raw token error is not an operator instruction. */
export function operatorJobError(reason: string | null | undefined): string | null {
  if (!reason) return null
  if (/api_key|access_token/i.test(reason)) {
    return "Kite rejected the session on this job, so it was not placed. Sign in again if you punched it yourself."
  }
  if (/too many skew\/network retries/i.test(reason)) {
    return "The straddle stopped. Price checks kept failing, so no order was sent."
  }
  if (/takeTradeIrrespectiveSkew is false/i.test(reason)) {
    return "The skew window ended and this template is set to reject the trade, so no order was sent."
  }
  return reason
}
