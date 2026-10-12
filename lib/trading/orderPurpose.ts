import type { OrderPurpose } from "./types"

/** Desk column allows EXIT, not FLATTEN. Risk still sees the caller's FLATTEN role. */
export function storedOrderPurpose(purpose: string | null | undefined): OrderPurpose | undefined {
  if (!purpose) return undefined
  if (purpose.toUpperCase() === "FLATTEN") return "EXIT"
  return purpose as OrderPurpose
}
