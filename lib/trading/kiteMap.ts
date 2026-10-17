import type { OrderStatus } from "./types"

const KITE_TO_STATUS: Record<string, OrderStatus> = {
  "PUT ORDER REQ RECEIVED": "SUBMITTED",
  "VALIDATION PENDING": "SUBMITTED",
  "OPEN PENDING": "SUBMITTED",
  "MODIFY PENDING": "ACCEPTED",
  "MODIFY VALIDATION PENDING": "ACCEPTED",
  "AMO REQ RECEIVED": "SUBMITTED",
  OPEN: "ACCEPTED",
  "TRIGGER PENDING": "ACCEPTED",
  COMPLETE: "FILLED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  "CANCEL PENDING": "CANCEL_REQUESTED",
  EXPIRED: "EXPIRED",
}

export function mapKiteOrderStatus(args: {
  kiteStatus?: string | null
  filledQty?: number
  requestedQty?: number
}): OrderStatus {
  const raw = (args.kiteStatus || "").toUpperCase().trim()
  let status = KITE_TO_STATUS[raw] ?? "UNKNOWN"
  const filled = args.filledQty ?? 0
  const requested = args.requestedQty ?? 0
  if (status === "ACCEPTED" && filled > 0 && (requested === 0 || filled < requested)) {
    status = "PARTIALLY_FILLED"
  }
  if (status === "ACCEPTED" && requested > 0 && filled >= requested) {
    status = "FILLED"
  }
  return status
}

/**
 * The order's filled quantity advances only after a fill row exists.
 * A failed insert leaves the previous quantity so the next snapshot retries.
 * FILLED / PARTIALLY_FILLED are held back in that case; cancel and reject still land.
 */
export function commitBrokerFillProgress(input: {
  previousFilledQty: number
  kiteFilledQty: number
  fillRowSaved: boolean
  fromStatus: string
  nextStatus: string
}): { filledQty: number; status: string } {
  const prev = Math.max(0, Math.trunc(Number(input.previousFilledQty)) || 0)
  const kite = Math.max(0, Math.trunc(Number(input.kiteFilledQty)) || 0)
  if (kite > prev && !input.fillRowSaved) {
    const hold = input.nextStatus === "FILLED" || input.nextStatus === "PARTIALLY_FILLED"
    return { filledQty: prev, status: hold ? input.fromStatus : input.nextStatus }
  }
  return {
    filledQty: Math.max(prev, kite),
    status: input.fromStatus === "FILLED" ? "FILLED" : input.nextStatus,
  }
}

export function fillFingerprint(args: {
  brokerOrderId?: string | null
  brokerTradeId?: string | null
  quantity: number
  price: string
  kind?: "trade" | "agg" | "migrated"
}): string {
  if (args.brokerTradeId) return `kite-trade:${args.brokerTradeId}`
  if (args.kind === "migrated" && args.brokerOrderId) {
    return `migrated-txn:${args.brokerOrderId}`
  }
  const orderId = args.brokerOrderId || "unknown"
  return `kite-order:${orderId}:agg:${args.quantity}:${args.price}`
}
