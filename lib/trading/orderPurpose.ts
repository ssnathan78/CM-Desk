import type { ExitReason, OrderPurpose } from "./types"

/** Desk column allows EXIT, not FLATTEN. Risk still sees the caller's FLATTEN role. */
export function storedOrderPurpose(purpose: string | null | undefined): OrderPurpose | undefined {
  if (!purpose) return undefined
  if (purpose.toUpperCase() === "FLATTEN") return "EXIT"
  return purpose as OrderPurpose
}

/** A protective stop close is a stop, even when the broker snapshot has no exit reason. */
export function exitReasonForOrderPurpose(
  purpose: string | null | undefined
): ExitReason | undefined {
  if (purpose === "SL") return "STOP_LOSS"
  return undefined
}

/**
 * Record an order-status event only when the row's status actually changes.
 * A repeat snapshot of an already filled order leaves `patch.status` unset;
 * that must not look like a new fill.
 */
export function shouldRecordOrderStatusEvent(
  fromStatus: string,
  patchStatus: string | undefined
): boolean {
  const persisted = patchStatus ?? fromStatus
  return fromStatus !== persisted
}
