import { type EXPIRY_TYPE, expiryTypesForInstrument, type INSTRUMENTS } from "./constants"

const OPEN_JOB_STATUSES = new Set(["PENDING", "QUEUE", "EXECUTING"])

export function migratedTemplateName(input: {
  name: string
  strategy: string
  dayOfWeek: string | null
  instrument: string
  nameCount: number
}): string {
  const base = input.name.trim() || "Template"
  if (input.nameCount <= 1) return base
  return [base, input.strategy, input.dayOfWeek, input.instrument].filter(Boolean).join(" ")
}

export function assertUniqueTemplateName(
  name: string,
  existing: string[],
  ignore?: string
): string | null {
  const trimmed = name.trim()
  if (!trimmed) return "Template name is required"
  const taken = existing.some(row => row !== ignore && row.toLowerCase() === trimmed.toLowerCase())
  if (taken) return "A template with this name already exists"
  return null
}

export function expiryRuleForInstrument(instrument: string, expiryType: string): string | null {
  const allowed = expiryTypesForInstrument(instrument as INSTRUMENTS)
  if (!allowed.includes(expiryType as EXPIRY_TYPE)) {
    return "That expiry is not available for this instrument"
  }
  return null
}

export function canDeleteTemplate(input: {
  scheduleCount: number
  openJobCount: number
}): string | null {
  if (input.scheduleCount > 0) return "Remove the weekday schedules before deleting this template"
  if (input.openJobCount > 0) return "A pending or open job still uses this template"
  return null
}

export function canUpdateJobFromTemplate(input: {
  status: string | null
  filledQty: number
}): { ok: true } | { ok: false; error: string } {
  if (input.filledQty > 0) {
    return { ok: false, error: "This job already has a fill. The template was not copied onto it." }
  }
  if (input.status && !OPEN_JOB_STATUSES.has(input.status)) {
    return { ok: false, error: "Only a pending job can be updated from its template." }
  }
  return { ok: true }
}
