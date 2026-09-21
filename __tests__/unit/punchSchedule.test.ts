import { INSTRUMENTS } from "../../lib/constants"
import { jobsForPunch } from "../../lib/punchSchedule"

describe("jobsForPunch", () => {
  it("fans out one job when Nifty is ticked", () => {
    const result = jobsForPunch({
      lots: 1,
      instruments: { [INSTRUMENTS.NIFTY]: true, [INSTRUMENTS.BANKNIFTY]: false },
    })
    expect(result).toEqual({
      ok: true,
      instruments: [INSTRUMENTS.NIFTY],
      lotsByInstrument: { [INSTRUMENTS.NIFTY]: 1 },
    })
  })

  it("fans out two jobs when Nifty and BankNifty are ticked", () => {
    const result = jobsForPunch({
      lots: 2,
      instruments: { [INSTRUMENTS.NIFTY]: true, [INSTRUMENTS.BANKNIFTY]: true },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.instruments).toEqual([INSTRUMENTS.NIFTY, INSTRUMENTS.BANKNIFTY])
      expect(result.lotsByInstrument).toEqual({
        [INSTRUMENTS.NIFTY]: 2,
        [INSTRUMENTS.BANKNIFTY]: 2,
      })
    }
  })

  it("refuses an empty instrument list (silent-success regression)", () => {
    const result = jobsForPunch({
      lots: 1,
      instruments: { [INSTRUMENTS.NIFTY]: false, [INSTRUMENTS.BANKNIFTY]: false },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.instruments).toEqual([])
      expect(result.error).toMatch(/index/i)
    }
  })

  it("uses per-index lots when punching more than one index", () => {
    const result = jobsForPunch({
      lots: 1,
      lotsByInstrument: { [INSTRUMENTS.NIFTY]: 2, [INSTRUMENTS.BANKNIFTY]: 4 },
      instruments: { [INSTRUMENTS.NIFTY]: true, [INSTRUMENTS.BANKNIFTY]: true },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lotsByInstrument).toEqual({
        [INSTRUMENTS.NIFTY]: 2,
        [INSTRUMENTS.BANKNIFTY]: 4,
      })
    }
  })
})
