import {
  type Money,
  moneyAdd,
  moneyDivQty,
  moneyFromUnknown,
  moneyMulQty,
  moneySub,
  moneyToString,
  moneyZero,
} from "./money"
import type { PositionEventKind, Side } from "./types"
import { directionFromQty, sideSign } from "./types"

export type PositionState = {
  quantity: number
  averagePrice: Money
  realizedPnl: Money
  fees: Money
  openedAt: Date | null
}

export type FillApplication = {
  side: Side
  quantity: number
  price: Money
  fee: Money
  at: Date
}

export type FillApplyResult = {
  next: PositionState
  eventKind: PositionEventKind
  realizedDelta: Money
  closedQty: number
  openedQty: number
  reversed: boolean
}

export function emptyPosition(): PositionState {
  return {
    quantity: 0,
    averagePrice: moneyZero(),
    realizedPnl: moneyZero(),
    fees: moneyZero(),
    openedAt: null,
  }
}

export function signedFillQty(side: Side, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("fill quantity must be a positive integer")
  }
  return sideSign(side) * quantity
}

function realizedOnClose(
  openQty: number,
  average: Money,
  closeQty: number,
  exitPrice: Money
): Money {
  if (openQty > 0) {
    return moneyMulQty(moneySub(exitPrice, average), closeQty)
  }
  return moneyMulQty(moneySub(average, exitPrice), closeQty)
}

export function applyFillToPosition(
  current: PositionState,
  fill: FillApplication
): FillApplyResult {
  const signed = signedFillQty(fill.side, fill.quantity)
  const nextFees = moneyAdd(current.fees, fill.fee)

  if (current.quantity === 0) {
    return {
      next: {
        quantity: signed,
        averagePrice: fill.price,
        realizedPnl: current.realizedPnl,
        fees: nextFees,
        openedAt: fill.at,
      },
      eventKind: "OPENED",
      realizedDelta: moneyZero(),
      closedQty: 0,
      openedQty: fill.quantity,
      reversed: false,
    }
  }

  const sameDirection = Math.sign(current.quantity) === Math.sign(signed)
  if (sameDirection) {
    const absOld = Math.abs(current.quantity)
    const numerator = moneyAdd(
      moneyMulQty(current.averagePrice, absOld),
      moneyMulQty(fill.price, fill.quantity)
    )
    const averagePrice = moneyDivQty(numerator, absOld + fill.quantity)
    return {
      next: {
        quantity: current.quantity + signed,
        averagePrice,
        realizedPnl: current.realizedPnl,
        fees: nextFees,
        openedAt: current.openedAt ?? fill.at,
      },
      eventKind: "INCREASED",
      realizedDelta: moneyZero(),
      closedQty: 0,
      openedQty: fill.quantity,
      reversed: false,
    }
  }

  const absOpen = Math.abs(current.quantity)
  if (fill.quantity < absOpen) {
    const realizedDelta = realizedOnClose(
      current.quantity,
      current.averagePrice,
      fill.quantity,
      fill.price
    )
    return {
      next: {
        quantity: current.quantity + signed,
        averagePrice: current.averagePrice,
        realizedPnl: moneyAdd(current.realizedPnl, realizedDelta),
        fees: nextFees,
        openedAt: current.openedAt,
      },
      eventKind: "REDUCED",
      realizedDelta,
      closedQty: fill.quantity,
      openedQty: 0,
      reversed: false,
    }
  }

  if (fill.quantity === absOpen) {
    const realizedDelta = realizedOnClose(
      current.quantity,
      current.averagePrice,
      fill.quantity,
      fill.price
    )
    return {
      next: {
        quantity: 0,
        averagePrice: moneyZero(),
        realizedPnl: moneyAdd(current.realizedPnl, realizedDelta),
        fees: nextFees,
        openedAt: current.openedAt,
      },
      eventKind: "CLOSED",
      realizedDelta,
      closedQty: fill.quantity,
      openedQty: 0,
      reversed: false,
    }
  }

  const closeQty = absOpen
  const leftover = fill.quantity - absOpen
  const realizedDelta = realizedOnClose(
    current.quantity,
    current.averagePrice,
    closeQty,
    fill.price
  )
  return {
    next: {
      quantity: Math.sign(signed) * leftover,
      averagePrice: fill.price,
      realizedPnl: moneyAdd(current.realizedPnl, realizedDelta),
      fees: nextFees,
      openedAt: fill.at,
    },
    eventKind: "REVERSED",
    realizedDelta,
    closedQty: closeQty,
    openedQty: leftover,
    reversed: true,
  }
}

export function unrealizedPnl(quantity: number, averagePrice: Money, markPrice: Money): Money {
  if (quantity === 0) return moneyZero()
  if (quantity > 0) {
    return moneyMulQty(moneySub(markPrice, averagePrice), quantity)
  }
  return moneyMulQty(moneySub(averagePrice, markPrice), Math.abs(quantity))
}

export function signedQty(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Live MTM. Qty 0 (flatten, expiry, recon flat) is always 0 — never keep the last open mark. */
export function positionMarkSnapshot(args: {
  quantity: number
  averagePrice: Money
  markPrice: Money | null
}): { unrealizedPnl: Money; marketValue: Money } {
  if (signedQty(args.quantity) === 0) {
    return { unrealizedPnl: moneyZero(), marketValue: moneyZero() }
  }
  if (args.markPrice == null) {
    return { unrealizedPnl: moneyZero(), marketValue: moneyZero() }
  }
  return {
    unrealizedPnl: unrealizedPnl(args.quantity, args.averagePrice, args.markPrice),
    marketValue: marketValue(args.quantity, args.markPrice),
  }
}

export function presentLedgerPosition<
  T extends {
    quantity: unknown
    status?: string | null
    markPrice?: string | null
    averageEntryPrice?: string | null
    unrealizedPnl?: string | null
    marketValue?: string | null
  },
>(row: T): T & { status: string; unrealizedPnl: string; marketValue: string } {
  const quantity = signedQty(row.quantity)
  if (quantity === 0) {
    return {
      ...row,
      status: "FLAT",
      unrealizedPnl: "0",
      marketValue: "0",
    }
  }
  if (row.markPrice == null || row.markPrice === "") {
    return {
      ...row,
      status: row.status || "OPEN",
      unrealizedPnl: row.unrealizedPnl ?? "0",
      marketValue: row.marketValue ?? "0",
    }
  }
  const live = positionMarkSnapshot({
    quantity,
    averagePrice: moneyFromUnknown(row.averageEntryPrice),
    markPrice: moneyFromUnknown(row.markPrice),
  })
  return {
    ...row,
    status: row.status || "OPEN",
    unrealizedPnl: moneyToString(live.unrealizedPnl),
    marketValue: moneyToString(live.marketValue),
  }
}

export function costBasis(quantity: number, averagePrice: Money): Money {
  return moneyMulQty(averagePrice, Math.abs(quantity))
}

export function marketValue(quantity: number, markPrice: Money): Money {
  return moneyMulQty(markPrice, quantity)
}

export function netRealized(gross: Money, fees: Money): Money {
  return moneySub(gross, fees)
}

export function incrementalFillFromAverages(args: {
  previousFilledQty: number
  previousAverage: Money
  newFilledQty: number
  newAverage: Money
}): { quantity: number; price: Money } | null {
  const delta = args.newFilledQty - args.previousFilledQty
  if (delta <= 0) return null
  if (args.previousFilledQty === 0) {
    return { quantity: args.newFilledQty, price: args.newAverage }
  }
  const incrementalValue = moneySub(
    moneyMulQty(args.newAverage, args.newFilledQty),
    moneyMulQty(args.previousAverage, args.previousFilledQty)
  )
  return {
    quantity: delta,
    price: moneyDivQty(incrementalValue, delta),
  }
}

export function inferPurpose(args: {
  orderType?: string | null
  transactionType?: string | null
  tag?: string | null
  isHedge?: boolean
}): import("./types").OrderPurpose {
  if (args.isHedge) return "HEDGE"
  const type = (args.orderType || "").toUpperCase()
  if (type === "SL" || type === "SL-M" || type === "SL-L") return "SL"
  return "ENTRY"
}

export { directionFromQty }
