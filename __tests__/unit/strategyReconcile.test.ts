import {
  acceptedQuantity,
  allocateBrokerTrades,
  strategyQuantityDifference,
} from "../../lib/trading/strategyReconcile"

describe("strategy reconcile", () => {
  it("treats a broker surplus and a broker shortfall as signed differences", () => {
    expect(strategyQuantityDifference({ brokerQty: 25, strategyQty: 10, otherQty: 0 })).toBe(15)
    expect(strategyQuantityDifference({ brokerQty: 5, strategyQty: 20, otherQty: 0 })).toBe(-15)
    expect(strategyQuantityDifference({ brokerQty: 30, strategyQty: 10, otherQty: 20 })).toBe(0)
  })

  it("lets the operator accept less of a buy or a sale, and refuses a larger or flipped quantity", () => {
    expect(acceptedQuantity(15, 10)).toBe(10)
    expect(acceptedQuantity(-15, -10)).toBe(-10)
    expect(acceptedQuantity(15, 16)).toBeNull()
    expect(acceptedQuantity(-15, -16)).toBeNull()
    expect(acceptedQuantity(15, -10)).toBeNull()
    expect(acceptedQuantity(-15, 10)).toBeNull()
  })

  it("leaves a shortfall when today's trades do not cover the accepted quantity", () => {
    const allocated = allocateBrokerTrades({
      accepted: -15,
      trades: [
        {
          tradeId: "t1",
          quantity: 10,
          price: 50,
          occurredAt: new Date("2026-10-15T04:00:00Z"),
          alreadyUsed: 0,
        },
      ],
    })
    expect(allocated.slices).toEqual([
      {
        tradeId: "t1",
        quantity: 10,
        price: 50,
        occurredAt: new Date("2026-10-15T04:00:00Z"),
        consumesTrade: true,
      },
    ])
    expect(allocated.shortfall).toBe(5)
  })
})
