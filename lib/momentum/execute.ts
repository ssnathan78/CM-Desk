import { getKiteInstance, placeOrder } from "../kiteUtils"
import logger from "../logger"
import type { PlannedOrder } from "./engine"

export type SubmitResult = {
  symbol: string
  side: string
  quantity: number
  ok: boolean
  message: string
}

export async function submitCashOrders(args: {
  accessToken?: string | null
  strategy: "MOMENTUM" | "DAILY_TREND"
  orders: Array<PlannedOrder & { purpose?: "ENTRY" | "EXIT" | "SL" | "FLATTEN" }>
}): Promise<SubmitResult[]> {
  if (!args.orders.length) return []
  const kite = getKiteInstance(args.accessToken || undefined)
  const results: SubmitResult[] = []
  for (const order of args.orders) {
    if (!(order.limitPrice && order.limitPrice > 0) || order.quantity <= 0) {
      results.push({
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        ok: false,
        message: "missing limit or quantity",
      })
      continue
    }
    try {
      await placeOrder(kite, kite.VARIETY_REGULAR, {
        exchange: "NSE",
        tradingsymbol: order.symbol,
        transaction_type: order.side,
        order_type: "LIMIT",
        quantity: order.quantity,
        product: "CNC",
        price: order.limitPrice,
        validity: "DAY",
        tag: args.strategy === "MOMENTUM" ? "momentum" : "dailytrend",
        purpose: order.purpose ?? order.role,
        strategy: args.strategy,
        ltp: order.limitPrice,
      })
      results.push({
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        ok: true,
        message: order.reason,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[cashOrders] ${order.side} ${order.symbol} rejected`, error)
      results.push({
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        ok: false,
        message,
      })
    }
  }
  return results
}
