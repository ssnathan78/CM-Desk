import {
  applyFillToPosition,
  emptyPosition,
  incrementalFillFromAverages,
  netRealized,
  positionMarkSnapshot,
  presentLedgerPosition,
  unrealizedPnl,
} from "../../../lib/trading/accounting"
import { moneyFromString, moneyToString } from "../../../lib/trading/money"

const at = new Date("2026-01-15T04:00:00.000Z")

function apply(side: "BUY" | "SELL", qty: number, price: string, current = emptyPosition()) {
  return applyFillToPosition(current, {
    side,
    quantity: qty,
    price: moneyFromString(price),
    fee: moneyFromString("0"),
    at,
  })
}

describe("position accounting", () => {
  it("opens a long and computes average on add", () => {
    const first = apply("BUY", 50, "100")
    expect(first.eventKind).toBe("OPENED")
    expect(first.next.quantity).toBe(50)
    const second = apply("BUY", 50, "110", first.next)
    expect(second.eventKind).toBe("INCREASED")
    expect(second.next.quantity).toBe(100)
    expect(moneyToString(second.next.averagePrice)).toBe("105.0000")
  })

  it("partial exit realizes P&L and leaves remainder average unchanged", () => {
    const open = apply("BUY", 100, "100")
    const reduce = apply("SELL", 40, "120", open.next)
    expect(reduce.eventKind).toBe("REDUCED")
    expect(reduce.next.quantity).toBe(60)
    expect(moneyToString(reduce.next.averagePrice)).toBe("100.0000")
    expect(moneyToString(reduce.realizedDelta)).toBe("800.0000")
  })

  it("full close zeros quantity and records realized", () => {
    const open = apply("SELL", 65, "80")
    const close = apply("BUY", 65, "70", open.next)
    expect(close.eventKind).toBe("CLOSED")
    expect(close.next.quantity).toBe(0)
    expect(moneyToString(close.realizedDelta)).toBe("650.0000")
  })

  it("reverses a short into a long", () => {
    const open = apply("SELL", 40, "100")
    const reverse = apply("BUY", 80, "90", open.next)
    expect(reverse.eventKind).toBe("REVERSED")
    expect(reverse.next.quantity).toBe(40)
    expect(moneyToString(reverse.next.averagePrice)).toBe("90.0000")
    expect(moneyToString(reverse.realizedDelta)).toBe("400.0000")
  })

  it("does not change realized P&L when mark moves", () => {
    const open = apply("BUY", 10, "100")
    const realized = open.next.realizedPnl
    const markUp = unrealizedPnl(open.next.quantity, open.next.averagePrice, moneyFromString("110"))
    expect(moneyToString(markUp)).toBe("100.0000")
    expect(open.next.realizedPnl).toBe(realized)
    const afterClose = apply("SELL", 10, "100", open.next)
    const stillClosed = unrealizedPnl(
      afterClose.next.quantity,
      afterClose.next.averagePrice,
      moneyFromString("200")
    )
    expect(moneyToString(stillClosed)).toBe("0.0000")
    expect(moneyToString(afterClose.next.realizedPnl)).toBe("0.0000")
  })

  it("flat and expired books have zero unrealized even if the last mark is still on the row", () => {
    const open = apply("SELL", 130, "22593")
    const whileOpen = positionMarkSnapshot({
      quantity: open.next.quantity,
      averagePrice: open.next.averagePrice,
      markPrice: moneyFromString("22618.4"),
    })
    expect(moneyToString(whileOpen.unrealizedPnl)).toBe("-3302.0000")
    const closed = apply("BUY", 130, "22618.4", open.next)
    const afterExpiry = positionMarkSnapshot({
      quantity: closed.next.quantity,
      averagePrice: closed.next.averagePrice,
      markPrice: moneyFromString("22618.4"),
    })
    expect(closed.next.quantity).toBe(0)
    expect(moneyToString(closed.next.realizedPnl)).toBe("-3302.0000")
    expect(moneyToString(afterExpiry.unrealizedPnl)).toBe("0.0000")
    expect(moneyToString(afterExpiry.marketValue)).toBe("0.0000")
  })

  it("presents pg string qty 0 with leftover MTM as flat unrealized 0", () => {
    const row = presentLedgerPosition({
      quantity: "0",
      status: "FLAT",
      unrealizedPnl: "39360",
      marketValue: "1800000",
      markPrice: "13687.55",
      averageEntryPrice: "0",
    })
    expect(row.unrealizedPnl).toBe("0")
    expect(row.marketValue).toBe("0")
    expect(row.status).toBe("FLAT")
  })

  it("net P&L subtracts fees", () => {
    expect(moneyToString(netRealized(moneyFromString("100"), moneyFromString("7.5")))).toBe(
      "92.5000"
    )
  })

  it("reconstructs incremental fill price from running averages", () => {
    const inc = incrementalFillFromAverages({
      previousFilledQty: 40,
      previousAverage: moneyFromString("100"),
      newFilledQty: 100,
      newAverage: moneyFromString("106"),
    })
    expect(inc?.quantity).toBe(60)
    expect(moneyToString(inc!.price)).toBe("110.0000")
  })

  it("rejects non-positive fill qty", () => {
    expect(() => apply("BUY", 0, "100")).toThrow(/positive/)
  })
})
