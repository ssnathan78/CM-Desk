import {
  completedDailyBars,
  emaFromCloses,
  evaluateDailyLong,
  sharesForBudget,
} from "../dailyTrend/engine"
import { istDate } from "./calendar"
import { type SubmitResult, submitCashOrders } from "./execute"
import {
  getDailyTrendState,
  holdingsFor,
  listDailyTrendBooks,
  loadBars,
  saveDailyTrendBook,
} from "./store"
import { ordersAllowed } from "./types"

export async function evaluateDailyTrend(args: { execute: boolean; accessToken?: string | null }) {
  const state = await getDailyTrendState()
  if (!state.config.active) {
    return { active: false, execution: state.config.execution, decisions: [] as const }
  }
  const books = await listDailyTrendBooks()
  const bars = await loadBars(books.map(book => book.symbol))
  const held = new Map((await holdingsFor("DAILY_TREND")).map(row => [row.symbol, row.quantity]))
  const allow = ordersAllowed({
    execution: state.config.execution,
    executeRequested: args.execute,
    due: state.config.execution === "auto",
  })
  const decisions: Array<{
    symbol: string
    action: string
    quantity?: number
    reason: string
    state: string
    ema?: number
    close?: number
    submitted?: SubmitResult | null
  }> = []
  for (const book of books) {
    if (!book.enabled) {
      decisions.push({
        symbol: book.symbol,
        action: "NONE",
        reason: "book off",
        state: book.status,
      })
      continue
    }
    const today = istDate(new Date())
    const history = completedDailyBars(
      (bars.get(book.symbol) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
      today
    )
    const ema = emaFromCloses(
      history.map(bar => bar.close),
      book.emaPeriod
    )
    const bar = history.at(-1)
    if (ema == null || !bar) {
      decisions.push({
        symbol: book.symbol,
        action: "NONE",
        reason: "not enough completed daily bars",
        state: book.status,
      })
      continue
    }
    const bookQty = held.get(book.symbol) ?? 0
    const decision = evaluateDailyLong({
      ema,
      bar,
      state: book.status,
      bookQty,
      stop: book.stop,
      entry: book.entry,
      config: {
        emaPeriod: book.emaPeriod,
        bufferPercent: book.bufferPercent,
        exitBufferPercent: book.exitBufferPercent,
        entryStyle: book.entryStyle,
        quantity: sharesForBudget(book.budgetInr, bar.close),
      },
    })
    const entryBlocked = book.paused && decision.role === "ENTRY"
    let result: SubmitResult | null = null
    if (allow && !entryBlocked && decision.action !== "NONE" && decision.quantity > 0) {
      const limit =
        decision.action === "BUY"
          ? bar.close * (1 + state.config.limitBufferPercent / 100)
          : bar.close * (1 - state.config.limitBufferPercent / 100)
      const [submitted] = await submitCashOrders({
        accessToken: args.accessToken,
        strategy: "DAILY_TREND",
        orders: [
          {
            symbol: book.symbol,
            side: decision.action,
            quantity: decision.quantity,
            role: decision.role === "SL" ? "EXIT" : decision.role === "FLATTEN" ? "EXIT" : "ENTRY",
            purpose:
              decision.role === "FLATTEN" ? "FLATTEN" : decision.role === "SL" ? "SL" : "ENTRY",
            limitPrice: Math.round(limit * 20) / 20,
            reason: decision.reason,
          },
        ],
      })
      result = submitted
    }
    if (allow) {
      const rejectedEntry = decision.role === "ENTRY" && result != null && !result.ok
      const nextStatus = bookQty > 0 ? "LONG" : rejectedEntry ? "FLAT" : decision.state
      await saveDailyTrendBook({
        ...book,
        status: nextStatus,
        stop: decision.stop,
        entry: decision.entry,
      })
    }
    decisions.push({
      symbol: book.symbol,
      action: entryBlocked ? "NONE" : decision.action,
      quantity: decision.quantity,
      reason: entryBlocked ? "paused; entry blocked, stop still armed" : decision.reason,
      state: bookQty > 0 ? "LONG" : decision.state,
      ema,
      close: bar.close,
      submitted: result,
    })
  }
  return { active: true, execution: state.config.execution, decisions }
}
