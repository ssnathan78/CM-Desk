/** How long a saved intent with no broker id stays "ack unknown" before a new place is allowed. */
export const BROKER_ACK_UNKNOWN_MS = 60_000

const RETRY_TERMINAL = new Set(["REJECTED", "FAILED", "CANCELLED"])

export class OrderAckUnknownError extends Error {
  constructor() {
    super("Broker acknowledgement is unknown for an existing order. Not placing another.")
    this.name = "OrderAckUnknownError"
  }
}

export type PlaceDecision =
  | { action: "place" }
  | { action: "reuse"; brokerOrderId: string }
  | { action: "lookup" }
  | { action: "wait" }

/**
 * A saved intent must not call the broker again while its ack is in doubt.
 * `created` means this call inserted the row. A retry sees `created: false`.
 * `brokerOrderIdFromBook` is undefined until the broker book has been read.
 */
export function decideBrokerPlace(input: {
  created: boolean
  status: string | null
  brokerOrderId: string | null
  ageMs: number
  brokerOrderIdFromBook?: string | null
}): PlaceDecision {
  if (input.created) return { action: "place" }
  const status = input.status || ""
  if (RETRY_TERMINAL.has(status)) return { action: "place" }
  if (input.brokerOrderId) return { action: "reuse", brokerOrderId: input.brokerOrderId }
  if (input.brokerOrderIdFromBook === undefined) return { action: "lookup" }
  if (input.brokerOrderIdFromBook) {
    return { action: "reuse", brokerOrderId: input.brokerOrderIdFromBook }
  }
  if (input.ageMs < BROKER_ACK_UNKNOWN_MS) return { action: "wait" }
  return { action: "place" }
}

/** Network and transport failures do not prove the broker rejected the order. */
export function isAmbiguousBrokerError(error: unknown): boolean {
  if (error instanceof OrderAckUnknownError) return true
  if (!error || typeof error !== "object") {
    return /timeout|network|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(
      String(error || "")
    )
  }
  const row = error as { error_type?: string; code?: string; message?: string }
  const type = row.error_type || ""
  if (type === "NetworkException") return true
  if (
    type === "InputException" ||
    type === "PermissionException" ||
    type === "TokenException" ||
    type === "OrderException"
  ) {
    return false
  }
  const code = String(row.code || "")
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(code)) {
    return true
  }
  return /timeout|socket hang up|network/i.test(String(row.message || ""))
}

export type BrokerOrderMatch = {
  order_id?: string | null
  tag?: string | null
  tradingsymbol?: string | null
  quantity?: number | null
  product?: string | null
  transaction_type?: string | null
  exchange?: string | null
  order_type?: string | null
  status?: string | null
}

/** First broker order that is the same instruction. Used when the ledger has no broker id yet. */
export function matchingBrokerOrderId(
  orders: BrokerOrderMatch[] | null | undefined,
  want: BrokerOrderMatch
): string | null {
  if (!orders?.length || !want.tradingsymbol) return null
  const hit = orders.find(order => {
    if (!order.order_id) return false
    if (want.tag && order.tag !== want.tag) return false
    if (order.tradingsymbol !== want.tradingsymbol) return false
    if (want.quantity != null && Number(order.quantity) !== Number(want.quantity)) return false
    if (want.product && order.product !== want.product) return false
    if (want.transaction_type && order.transaction_type !== want.transaction_type) return false
    if (want.exchange && order.exchange !== want.exchange) return false
    if (want.order_type && order.order_type !== want.order_type) return false
    return true
  })
  return hit?.order_id || null
}

const WORKING = new Set([
  "PENDING",
  "SUBMITTED",
  "ACCEPTED",
  "PARTIALLY_FILLED",
  "UNKNOWN",
  "CANCEL_REQUESTED",
])

/** A working entry on this symbol blocks another buy after a crash, even if the limit price changed. */
export function workingEntryCount(
  orders: Array<{
    tradingsymbol?: string | null
    strategy?: string | null
    purpose?: string | null
    status?: string | null
  }>,
  symbol: string,
  strategy: string
): number {
  return orders.filter(order => {
    if (order.tradingsymbol !== symbol || order.strategy !== strategy) return false
    if (order.purpose && order.purpose !== "ENTRY") return false
    return WORKING.has(String(order.status || ""))
  }).length
}

/** BullMQ rejects a second add with the same job id. That is success for a follow-up retry. */
export function isDuplicateJobError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "")
  return /already exists|already waiting|job id already/i.test(message)
}

export function followUpJobId(kind: "exit" | "target" | "aso", executionId: string): string {
  return `${kind}-${executionId}`
}
