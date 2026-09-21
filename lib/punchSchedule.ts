import {
  selectedTradeInstruments,
  validateLots,
  validateSelectedInstruments,
} from "./strategyValidation"

export type PunchJobsResult =
  | { ok: true; instruments: string[]; lotsByInstrument: Record<string, number> }
  | { ok: false; error: string; instruments: string[] }

/** Fan-out list for Schedule now / Schedule at. Empty instruments is a hard fail. */
export function jobsForPunch(input: {
  instruments?: Record<string, boolean | undefined> | null
  lots?: unknown
  lotsByInstrument?: Record<string, unknown> | null
  maxLots?: number
}): PunchJobsResult {
  const instrumentsCheck = validateSelectedInstruments(input.instruments)
  if (!instrumentsCheck.ok) {
    return { ok: false, error: instrumentsCheck.error, instruments: [] }
  }
  const instruments = selectedTradeInstruments(input.instruments)
  const lotsByInstrument: Record<string, number> = {}
  for (const instrument of instruments) {
    const raw = input.lotsByInstrument?.[instrument] ?? input.lots
    const lotsCheck = validateLots(raw, input.maxLots)
    if (!lotsCheck.ok) {
      return { ok: false, error: `${instrument}: ${lotsCheck.error}`, instruments: [] }
    }
    lotsByInstrument[instrument] = Number(raw)
  }
  return { ok: true, instruments, lotsByInstrument }
}
