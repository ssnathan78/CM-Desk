import type { NextApiResponse } from "next"
import type { Logger } from "winston"

const SENSITIVE_PATTERNS = [
  /access_token/i,
  /refresh_token/i,
  /SECRET_COOKIE_PASSWORD/i,
  /KITE_API_SECRET/i,
  /password/i,
]

export function redactForLog(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === "string") {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(value)) return "[REDACTED]"
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(redactForLog)
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
        out[key] = "[REDACTED]"
      } else {
        out[key] = redactForLog(val)
      }
    }
    return out
  }
  return value
}

const UNSAFE_CLIENT_MESSAGE =
  /failed query:|\bparams:|syntax error|password|access_token|refresh_token|api_secret|secret_cookie|\bat\s+\S+\(/i

/** Query text, bound parameters, stacks, and credentials stay in the server log. */
export function messageLooksUnsafe(message: string): boolean {
  return message.includes("\n") || UNSAFE_CLIENT_MESSAGE.test(message)
}

export function safeErrorMessage(err: unknown, fallback = "Internal server error"): string {
  if (!(err instanceof Error) || !err.message) {
    return process.env.NODE_ENV === "production" ? fallback : String(err)
  }
  if (messageLooksUnsafe(err.message)) return fallback
  if (process.env.NODE_ENV !== "production") return err.message
  if (err.message.length > 300) return fallback
  return err.message
}

export function sendApiError(
  res: NextApiResponse,
  err: unknown,
  logger: Logger,
  context: string,
  status = 500
) {
  logger.error(`[${context}]`, err)
  return res.status(status).json({ error: safeErrorMessage(err) })
}
