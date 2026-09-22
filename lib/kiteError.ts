/**
 * Kite Connect rejects with a plain object (`{ message, error_type, status }`), not an Error.
 * `String(that)` is "[object Object]", which is what Desk was storing on failed orders.
 */
export function formatThrownMessage(error: unknown, fallback = "Unknown error"): string {
  if (typeof error === "string") {
    const text = error.trim()
    return text || fallback
  }
  if (error instanceof Error) {
    const text = error.message.trim()
    return text || fallback
  }
  if (error && typeof error === "object") {
    const row = error as { message?: unknown; error_type?: unknown }
    const message = typeof row.message === "string" ? row.message.trim() : ""
    const errorType = typeof row.error_type === "string" ? row.error_type.trim() : ""
    if (errorType && message && !message.includes(errorType)) return `${errorType}: ${message}`
    if (message) return message
    if (errorType) return errorType
  }
  return fallback
}
