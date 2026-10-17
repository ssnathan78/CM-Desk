import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

import { IST_TZ } from "./marketCalendar"

dayjs.extend(utc)
dayjs.extend(timezone)

export type ActionOutcome = {
  severity: "success" | "error" | "info"
  text: string
}

export function feedClearMenuCopy(kind: "alerts" | "signals"): {
  button: string
  note: string
  items: Array<{ period: "today" | "before_today" | "all"; label: string }>
} {
  if (kind === "alerts") {
    return {
      button: "Hide alerts…",
      note: "Hides these rows from this list. Ledger, jobs, and orders stay.",
      items: [
        { period: "today", label: "Hide today…" },
        { period: "before_today", label: "Hide before today…" },
        { period: "all", label: "Hide all…" },
      ],
    }
  }
  return {
    button: "Clear signals…",
    note: "Deletes stored signal rows in that window. New evaluations still appear.",
    items: [
      { period: "today", label: "Clear today…" },
      { period: "before_today", label: "Clear before today…" },
      { period: "all", label: "Clear all…" },
    ],
  }
}

export function executionLabel(execution: string): string {
  if (execution === "report") return "Report only"
  if (execution === "manual") return "Manual send"
  if (execution === "auto") return "Auto"
  return execution
}

/** Draft switches are not what the hourly pass or Send will use. */
export function unsavedRuntimeNote(
  saved: { active: boolean; execution: string },
  draft: { active: boolean; execution: string }
): string | null {
  const parts: string[] = []
  if (saved.active !== draft.active) {
    parts.push(`Saved engine is ${saved.active ? "on" : "off"}.`)
  }
  if (saved.execution !== draft.execution) {
    parts.push(`Saved execution is ${executionLabel(saved.execution)}.`)
  }
  if (!parts.length) return null
  return `Unsaved. ${parts.join(" ")} Save before this screen is what the desk will use.`
}

/** True when a due-today schedule will punch as soon as it is enqueued. */
export function dueScheduleRunsNow(now: Date, runAt?: string | null): boolean {
  if (!runAt) return true
  return dayjs(now).isAfter(dayjs(runAt))
}

export function dueSchedulePresentation(input: {
  now: Date
  runAt?: string | null
  name: string
  detail: string
}): { runsNow: boolean; buttonLabel: string; title: string; message: string } {
  const runsNow = dueScheduleRunsNow(input.now, input.runAt)
  const clock = input.runAt ? dayjs(input.runAt).tz(IST_TZ).format("HH:mm") : null
  const who = input.detail ? `${input.name} (${input.detail})` : input.name
  if (runsNow) {
    return {
      runsNow: true,
      buttonLabel: "Run now…",
      title: `Run ${input.name} now?`,
      message: clock
        ? `Create a job from ${who} and run it now. The template clock ${clock} IST has passed.`
        : `Create a job from ${who} and run it now. This template has no clock time.`,
    }
  }
  return {
    runsNow: false,
    buttonLabel: `Queue for ${clock}`,
    title: `Queue ${input.name} for ${clock} IST?`,
    message: `Queue ${who} for ${clock} IST today. It will not run until that time. If that clock has already passed when the request arrives, the job runs immediately.`,
  }
}

export function chaseSquareOffCopy(instrument: string | null): { title: string; message: string } {
  if (instrument) {
    return {
      title: `Square off ${instrument}?`,
      message: `This flattens the open ${instrument} Chase book only and returns that book to AWAITING_SIGNAL when it is flat. Other Chase books stay. It does not pause Chase or halt the desk. A live book is refused while the market is closed: the position and its stop stay. Paper still flattens.`,
    }
  }
  return {
    title: "Square off every Chase book?",
    message:
      "This flattens every open Chase book, including added stocks, and returns each flat book to AWAITING_SIGNAL. It does not pause Chase or halt the desk. A live book is refused while the market is closed: that position and its stop stay. Paper still flattens.",
  }
}

/** Capital INR moves only when every trim sell was accepted. */
export function trimCapitalShouldReduce(results: Array<{ ok: boolean }>): boolean {
  return results.length > 0 && results.every(row => row.ok)
}

export function cashSubmitNotice(input: {
  action: "rebalance" | "deploy" | "trim"
  results: Array<{ symbol: string; side: string; ok: boolean; message: string }>
  dayMarked: boolean
  capitalReduced: boolean
}): ActionOutcome {
  const rejected = input.results.filter(row => !row.ok)
  const accepted = input.results.filter(row => row.ok)
  const lines: string[] = []
  if (input.results.length === 0) {
    lines.push("No orders were sent.")
  } else if (rejected.length === 0) {
    lines.push(`Accepted ${accepted.length} order(s).`)
  } else {
    const detail = rejected
      .slice(0, 8)
      .map(row => `${row.side} ${row.symbol}: ${row.message}`)
      .join("; ")
    const more = rejected.length > 8 ? ` and ${rejected.length - 8} more` : ""
    lines.push(
      `${rejected.length} rejected${accepted.length ? `, ${accepted.length} accepted` : ""}. ${detail}${more}.`
    )
  }
  if (input.dayMarked) {
    lines.push("This rebalance day is marked done and will not be retried.")
  }
  if (input.action === "trim") {
    lines.push(
      input.capitalReduced
        ? "Capital INR was reduced by the trim percent."
        : "Capital INR was not reduced."
    )
  }
  const severity: ActionOutcome["severity"] =
    rejected.length > 0 ? "error" : input.results.length === 0 ? "info" : "success"
  return { severity, text: lines.join(" ") }
}

export function dailyTrendEvaluateNotice(input: {
  execute: boolean
  active: boolean
  savedExecution: string
  decisions: Array<{
    symbol: string
    action: string
    submitted?: { ok: boolean; message: string } | null
  }>
}): ActionOutcome {
  if (!input.active) {
    return {
      severity: "error",
      text: "Engine is off. Nothing was evaluated and no orders were sent.",
    }
  }
  const buys = input.decisions.filter(row => row.action === "BUY").length
  const sells = input.decisions.filter(row => row.action === "SELL").length
  const tally = `Decision list: ${buys} buy(s), ${sells} sell(s).`
  if (!input.execute) {
    return { severity: "info", text: `No orders sent. ${tally}` }
  }
  if (input.savedExecution === "report") {
    return {
      severity: "error",
      text: `Saved execution is Report only. No orders sent. ${tally}`,
    }
  }
  const rejected = input.decisions.filter(row => row.submitted && !row.submitted.ok)
  const accepted = input.decisions.filter(row => row.submitted?.ok)
  if (rejected.length) {
    const detail = rejected
      .slice(0, 8)
      .map(row => `${row.symbol}: ${row.submitted?.message ?? "rejected"}`)
      .join("; ")
    return {
      severity: "error",
      text: `${rejected.length} rejected${accepted.length ? `, ${accepted.length} accepted` : ""}. ${detail}.`,
    }
  }
  if (!accepted.length) {
    return { severity: "info", text: `No orders sent. ${tally}` }
  }
  return { severity: "success", text: `Accepted ${accepted.length} order(s).` }
}

export function symbolOffConfirm(symbols: string[]): { title: string; message: string } {
  const shown = symbols.slice(0, 12).join(", ")
  const list = symbols.length > 12 ? `${shown}, and ${symbols.length - 12} more` : shown
  return {
    title: symbols.length === 1 ? `Turn ${symbols[0]} off?` : `Turn ${symbols.length} symbols off?`,
    message: `Turn off ${list}? Off is fully dark: no new buy and no stop. The stored stop price stays on the row. Shares already at the broker stay there.`,
  }
}

export function removeDailyTrendConfirm(symbol: string): { title: string; message: string } {
  return {
    title: `Remove ${symbol} from the daily-trend list?`,
    message: `Deletes ${symbol} from this page. Shares at the broker stay. The stop will not run. This does not send an order.`,
  }
}

export function constituentDropConfirm(
  book: "momentum" | "trend",
  symbol: string
): { title: string; message: string } {
  if (book === "trend") {
    return {
      title: `Drop ${symbol} from the daily-trend list?`,
      message: `Removes ${symbol} from the daily-trend book. Shares at the broker stay. The stop will not run. This does not send an order.`,
    }
  }
  return {
    title: `Drop ${symbol} from the rank list?`,
    message: `Removes ${symbol} from the momentum rank list. Shares you hold are not sold by this click.`,
  }
}

export function constituentKeepConfirm(
  book: "momentum" | "trend",
  side: "ADD" | "REMOVE",
  count: number
): { title: string; message: string } {
  const where = book === "trend" ? "daily trend" : "momentum"
  if (side === "REMOVE") {
    return {
      title: `Keep these ${count} names?`,
      message: `Dismisses ${count} pending drop(s) on ${where}. The names stay on the list. Nothing is sold.`,
    }
  }
  return {
    title: `Skip these ${count} adds?`,
    message: `Dismisses ${count} pending add(s) on ${where}. Those names are not added. Nothing is bought.`,
  }
}

export function intradaySwitchLabel(straddleOn: boolean, strangleOn: boolean): string {
  if (straddleOn && strangleOn) return "Straddle on · Strangle on"
  if (!straddleOn && !strangleOn) return "Straddle off · Strangle off"
  return `Straddle ${straddleOn ? "on" : "off"} · Strangle ${strangleOn ? "on" : "off"}`
}

export const CHASE_GROUP_PNL_TITLE =
  "Closed today and realized lifetime are all Chase books together. The figure is on the first Chase row."

export function chaseResetConfirm(instruments: string[]): { title: string; message: string } {
  const names = instruments.length ? instruments.join(", ") : "no books"
  return {
    title: "Reset every Chase book to a fresh signal?",
    message: `Reset ${names} to AWAITING_SIGNAL? If any book still has futures quantity, or quantity cannot be proved, the whole reset is refused and nothing is changed. This does not send a flatten.`,
  }
}

export type ChaseResetProbe = { instrument: string; state: "clear" | "open" | "unknown" }

/** Refuse the whole Chase signal reset when any book is open or unproved. */
export function planChaseSignalReset(
  probes: ChaseResetProbe[]
): { ok: true } | { ok: false; error: string; open: string[] } {
  const unknown = probes.filter(row => row.state === "unknown").map(row => row.instrument)
  if (unknown.length) {
    const verb = unknown.length === 1 ? "is" : "are"
    return {
      ok: false,
      open: [],
      error: `Could not prove ${unknown.join(", ")} ${verb} flat, so nothing was changed.`,
    }
  }
  const open = probes.filter(row => row.state === "open").map(row => row.instrument)
  if (open.length) {
    return {
      ok: false,
      open,
      error: `Reset refused. Nothing was changed. Still open: ${open.join(", ")}.`,
    }
  }
  return { ok: true }
}
