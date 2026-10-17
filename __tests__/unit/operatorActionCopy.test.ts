import { killDialogNotice } from "../../lib/killNotice"
import {
  cashSubmitNotice,
  chaseResetConfirm,
  chaseSquareOffCopy,
  constituentDropConfirm,
  constituentKeepConfirm,
  dailyTrendEvaluateNotice,
  dueSchedulePresentation,
  dueScheduleRunsNow,
  intradaySwitchLabel,
  planChaseSignalReset,
  symbolOffConfirm,
  trimCapitalShouldReduce,
  unsavedRuntimeNote,
} from "../../lib/operatorActionCopy"

describe("unsavedRuntimeNote", () => {
  it("is quiet when the draft matches the saved row", () => {
    expect(
      unsavedRuntimeNote(
        { active: true, execution: "auto" },
        { active: true, execution: "auto" }
      )
    ).toBeNull()
  })

  it("names the saved execution when the menu has moved", () => {
    const note = unsavedRuntimeNote(
      { active: true, execution: "auto" },
      { active: true, execution: "report" }
    )
    expect(note).toMatch(/Unsaved/)
    expect(note).toMatch(/Saved execution is Auto/)
  })
})

describe("dueSchedulePresentation", () => {
  const runAt = "2026-10-17T09:20:00+05:30"

  it("queues before the template clock", () => {
    const now = new Date("2026-10-17T09:00:00+05:30")
    expect(dueScheduleRunsNow(now, runAt)).toBe(false)
    const view = dueSchedulePresentation({
      now,
      runAt,
      name: "Nifty straddle",
      detail: "ATM straddle · NIFTY",
    })
    expect(view.buttonLabel).toBe("Queue for 09:20")
    expect(view.runsNow).toBe(false)
    expect(view.message).toMatch(/will not run until that time/)
    expect(view.message).toMatch(/runs immediately/)
  })

  it("says run now after the template clock", () => {
    const now = new Date("2026-10-17T10:00:00+05:30")
    const view = dueSchedulePresentation({
      now,
      runAt,
      name: "Nifty straddle",
      detail: "ATM straddle · NIFTY",
    })
    expect(view.runsNow).toBe(true)
    expect(view.buttonLabel).toBe("Run now…")
    expect(view.message).toMatch(/run it now/)
    expect(view.message).toMatch(/09:20 IST has passed/)
  })

  it("runs now when the template has no clock", () => {
    expect(dueScheduleRunsNow(new Date(), null)).toBe(true)
  })
})

describe("chaseSquareOffCopy", () => {
  it("names one book and says the others stay", () => {
    const copy = chaseSquareOffCopy("RELIANCE")
    expect(copy.title).toMatch(/RELIANCE/)
    expect(copy.message).toMatch(/only/)
    expect(copy.message).toMatch(/Other Chase books stay/)
  })

  it("names every book when no instrument is given", () => {
    const copy = chaseSquareOffCopy(null)
    expect(copy.title).toMatch(/every Chase book/i)
    expect(copy.message).toMatch(/including added stocks/)
  })
})

describe("cashSubmitNotice", () => {
  it("does not say sent when a line was rejected, and says the day is marked", () => {
    const notice = cashSubmitNotice({
      action: "rebalance",
      results: [
        { symbol: "INFY", side: "BUY", ok: false, message: "RMS" },
        { symbol: "TCS", side: "BUY", ok: true, message: "ok" },
      ],
      dayMarked: true,
      capitalReduced: false,
    })
    expect(notice.severity).toBe("error")
    expect(notice.text).toMatch(/INFY/)
    expect(notice.text).toMatch(/marked done/)
    expect(notice.text).not.toMatch(/Rebalance sent/)
  })

  it("does not call an empty send a success", () => {
    const notice = cashSubmitNotice({
      action: "deploy",
      results: [],
      dayMarked: false,
      capitalReduced: false,
    })
    expect(notice.severity).toBe("info")
    expect(notice.text).toMatch(/No orders were sent/)
  })

  it("says capital was not reduced when trim sells were rejected", () => {
    expect(trimCapitalShouldReduce([{ ok: false }])).toBe(false)
    expect(trimCapitalShouldReduce([])).toBe(false)
    expect(trimCapitalShouldReduce([{ ok: true }])).toBe(true)
    const notice = cashSubmitNotice({
      action: "trim",
      results: [{ symbol: "INFY", side: "SELL", ok: false, message: "rejected" }],
      dayMarked: false,
      capitalReduced: false,
    })
    expect(notice.text).toMatch(/Capital INR was not reduced/)
  })
})

describe("dailyTrendEvaluateNotice", () => {
  it("does not claim report mode when listing decisions", () => {
    const notice = dailyTrendEvaluateNotice({
      execute: false,
      active: true,
      savedExecution: "manual",
      decisions: [{ symbol: "INFY", action: "SELL" }],
    })
    expect(notice.severity).toBe("info")
    expect(notice.text).toMatch(/No orders sent/)
    expect(notice.text).toMatch(/1 sell/)
    expect(notice.text).not.toMatch(/report mode/i)
  })

  it("names a broker reject instead of saying finished", () => {
    const notice = dailyTrendEvaluateNotice({
      execute: true,
      active: true,
      savedExecution: "manual",
      decisions: [
        {
          symbol: "INFY",
          action: "SELL",
          submitted: { ok: false, message: "circuit" },
        },
      ],
    })
    expect(notice.severity).toBe("error")
    expect(notice.text).toMatch(/INFY/)
    expect(notice.text).toMatch(/circuit/)
  })

  it("says the engine is off", () => {
    expect(
      dailyTrendEvaluateNotice({
        execute: true,
        active: false,
        savedExecution: "auto",
        decisions: [],
      }).text
    ).toMatch(/Engine is off/)
  })
})

describe("symbol and constituent confirms", () => {
  it("says a symbol off does not run the stop", () => {
    expect(symbolOffConfirm(["INFY"]).message).toMatch(/no stop/)
    expect(symbolOffConfirm(["INFY"]).message).toMatch(/Shares already at the broker stay/)
  })

  it("says a daily-trend drop leaves the shares", () => {
    expect(constituentDropConfirm("trend", "INFY").message).toMatch(/stop will not run/)
    expect(constituentKeepConfirm("trend", "REMOVE", 2).message).toMatch(/names stay/)
  })
})

describe("desk labels", () => {
  it("does not call a disabled straddle engine on", () => {
    expect(intradaySwitchLabel(false, true)).toBe("Straddle off · Strangle on")
    expect(intradaySwitchLabel(false, false)).toBe("Straddle off · Strangle off")
  })

  it("lists every Chase book in the reset confirm", () => {
    const copy = chaseResetConfirm(["NIFTY", "RELIANCE"])
    expect(copy.message).toMatch(/NIFTY, RELIANCE/)
    expect(copy.message).toMatch(/nothing is changed/)
  })
})

describe("planChaseSignalReset", () => {
  it("refuses the whole reset when one book is open", () => {
    const plan = planChaseSignalReset([
      { instrument: "NIFTY", state: "clear" },
      { instrument: "RELIANCE", state: "open" },
    ])
    expect(plan.ok).toBe(false)
    if (!plan.ok) {
      expect(plan.error).toMatch(/Nothing was changed/)
      expect(plan.error).toMatch(/RELIANCE/)
      expect(plan.open).toEqual(["RELIANCE"])
    }
  })

  it("refuses when quantity is unknown", () => {
    const plan = planChaseSignalReset([{ instrument: "INFY", state: "unknown" }])
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.error).toMatch(/nothing was changed/i)
  })

  it("allows a reset when every book is clear", () => {
    expect(planChaseSignalReset([{ instrument: "NIFTY", state: "clear" }]).ok).toBe(true)
  })
})

describe("killDialogNotice", () => {
  it("stays on the dialog when flatten did not run", () => {
    const notice = killDialogNotice({
      scope: "intraday",
      liveLeftOpen: false,
      chasePaused: false,
      deskHalted: true,
      flattenFailed: true,
    })
    expect(notice.severity).toBe("error")
    expect(notice.text).toMatch(/Flatten did not run/)
    expect(notice.text).toMatch(/desk is halted/i)
  })

  it("has a success sentence when halt and pause both landed", () => {
    const notice = killDialogNotice({
      scope: "all",
      liveLeftOpen: false,
      chasePaused: true,
      deskHalted: true,
    })
    expect(notice.severity).toBe("success")
    expect(notice.text).toMatch(/Chase is paused/)
    expect(notice.text).toMatch(/desk is halted/i)
  })
})
