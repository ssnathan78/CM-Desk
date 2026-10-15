export type StrategyGap = {
  exchange: string
  tradingsymbol: string
  product: string
  brokerQty: number
  strategyQty: number
  otherQty: number
  difference: number
}

export function strategyQuantityDifference(input: {
  brokerQty: number
  strategyQty: number
  otherQty: number
}): number {
  return input.brokerQty - input.otherQty - input.strategyQty
}

/** Same sign as the difference, and no larger. Zero and a flipped sign are refused. */
export function acceptedQuantity(difference: number, requested: number): number | null {
  if (!Number.isInteger(difference) || !Number.isInteger(requested)) return null
  if (difference === 0 || requested === 0) return null
  if (Math.sign(requested) !== Math.sign(difference)) return null
  if (Math.abs(requested) > Math.abs(difference)) return null
  return requested
}

export type TradeSlice = {
  tradeId: string
  quantity: number
  price: number
  occurredAt: Date
  alreadyUsed: number
}

export type AllocatedSlice = {
  tradeId: string
  quantity: number
  price: number
  occurredAt: Date
  consumesTrade: boolean
}

/** Oldest trades first. Returns how many shares of the accepted quantity still have no trade. */
export function allocateBrokerTrades(input: { accepted: number; trades: TradeSlice[] }): {
  slices: AllocatedSlice[]
  shortfall: number
} {
  let remaining = Math.abs(input.accepted)
  const slices: AllocatedSlice[] = []
  const ordered = input.trades
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
  for (const trade of ordered) {
    if (remaining <= 0) break
    const available = trade.quantity - trade.alreadyUsed
    if (!(available > 0) || !(trade.price > 0)) continue
    const take = Math.min(available, remaining)
    slices.push({
      tradeId: trade.tradeId,
      quantity: take,
      price: trade.price,
      occurredAt: trade.occurredAt,
      consumesTrade: trade.alreadyUsed === 0 && take === trade.quantity,
    })
    remaining -= take
  }
  return { slices, shortfall: remaining }
}
