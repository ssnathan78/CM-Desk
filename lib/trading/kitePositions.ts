export class KitePositionsUnavailableError extends Error {
  constructor() {
    super("Kite positions unavailable")
    this.name = "KitePositionsUnavailableError"
  }
}

/** A missing symbol in a real net array is flat. A missing book is not flat. */
export function kiteNetQuantity(
  book: { net?: unknown } | null | undefined,
  tradingsymbol: string
): number {
  if (!book || !Array.isArray(book.net)) throw new KitePositionsUnavailableError()
  const row = (book.net as Array<{ tradingsymbol?: string; quantity?: number }>).find(
    p => p.tradingsymbol === tradingsymbol
  )
  return Number(row?.quantity || 0)
}

/** Callers that refuse the ledger fallback must see a failure, not quantity 0. */
export function rethrowKiteQtyFailure(opts?: {
  strict?: boolean
  ledgerFallback?: boolean
}): boolean {
  return opts?.strict === true || opts?.ledgerFallback === false
}
