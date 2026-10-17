import { parseFlattenScope } from "../../lib/flattenScope"
import {
  type FlattenOpenResult,
  LIVE_FLATTEN_MARKET_CLOSED,
  flattenOperatorNotice,
  liveFlattenSessionBlock,
} from "../../lib/flattenNotice"

describe("parseFlattenScope", () => {
  it("accepts exactly one selector", () => {
    expect(parseFlattenScope({ all: true })).toEqual({ ok: true, scope: { kind: "all" } })
    expect(parseFlattenScope({ intraday: true })).toEqual({
      ok: true,
      scope: { kind: "intraday" },
    })
    expect(parseFlattenScope({ strategy: "chase" })).toEqual({
      ok: true,
      scope: { kind: "strategy", strategy: "CHASE" },
    })
    expect(parseFlattenScope({ jobId: " job-1 " })).toEqual({
      ok: true,
      scope: { kind: "job", jobId: "job-1" },
    })
    expect(parseFlattenScope({ positionId: "pos-1" })).toEqual({
      ok: true,
      scope: { kind: "position", positionId: "pos-1" },
    })
    expect(parseFlattenScope({ strategy: "CHASE", instrument: "nifty" })).toEqual({
      ok: true,
      scope: { kind: "chaseBook", instrument: "NIFTY" },
    })
    expect(parseFlattenScope({ instrument: "RELIANCE" })).toEqual({
      ok: true,
      scope: { kind: "chaseBook", instrument: "RELIANCE" },
    })
  })

  it("rejects missing, unknown, or mixed selectors", () => {
    expect(parseFlattenScope({}).ok).toBe(false)
    expect(parseFlattenScope({ strategy: "IRON_FLY" }).ok).toBe(false)
    expect(parseFlattenScope({ all: true, strategy: "CHASE" }).ok).toBe(false)
    expect(parseFlattenScope({ strategy: "ATM_STRADDLE", instrument: "NIFTY" }).ok).toBe(false)
    expect(parseFlattenScope({ instrument: "NIFTY26OCTFUT" }).ok).toBe(false)
  })
})

const emptyFlatten = (): FlattenOpenResult => ({
  flattened: [],
  skipped: [],
  abortedJobs: [],
  chaseReset: [],
})

describe("liveFlattenSessionBlock", () => {
  it("refuses a live book when the session is closed and does not describe a cancel", () => {
    expect(liveFlattenSessionBlock({ paperBook: false, marketOpen: false })).toBe(
      LIVE_FLATTEN_MARKET_CLOSED
    )
  })

  it("allows a live book during the session", () => {
    expect(liveFlattenSessionBlock({ paperBook: false, marketOpen: true })).toBeNull()
  })

  it("allows a paper book when the session is closed", () => {
    expect(liveFlattenSessionBlock({ paperBook: true, marketOpen: false })).toBeNull()
  })
})

describe("flattenOperatorNotice", () => {
  it("does not claim success when a live book was left open", () => {
    const notice = flattenOperatorNotice(
      {
        ...emptyFlatten(),
        skipped: [{ tradingsymbol: "NIFTY26OCTFUT", reason: LIVE_FLATTEN_MARKET_CLOSED }],
      },
      "Chase squared off. The next hourly job can take a fresh signal."
    )
    expect(notice.severity).toBe("error")
    expect(notice.text).toMatch(/nothing was squared off/i)
    expect(notice.text).toMatch(/stops were left unchanged/i)
  })

  it("uses the success text when a cover was sent", () => {
    expect(
      flattenOperatorNotice(
        {
          ...emptyFlatten(),
          flattened: [
            { positionId: "1", tradingsymbol: "NIFTY26OCTFUT", qty: 65, side: "SELL" },
          ],
        },
        "Chase squared off."
      )
    ).toEqual({ severity: "success", text: "Chase squared off." })
  })
})
