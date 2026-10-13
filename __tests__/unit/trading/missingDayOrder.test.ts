import { missingDayOrderShouldExpire } from "../../../lib/trading/missingDayOrder"

const NOW = new Date("2026-10-13T12:30:00.000Z") // 18:00 IST

describe("missingDayOrderShouldExpire", () => {
  it("expires a prior-day DAY order that never filled", () => {
    expect(
      missingDayOrderShouldExpire({
        status: "ACCEPTED",
        validity: "DAY",
        filledQty: 0,
        updatedAt: new Date("2026-10-09T10:00:00.000Z"), // 15:30 IST 9 Oct
        now: NOW,
      })
    ).toBe(true)
  })

  it("expires a prior-day IOC order", () => {
    expect(
      missingDayOrderShouldExpire({
        status: "SUBMITTED",
        validity: "ioc",
        filledQty: 0,
        updatedAt: new Date("2026-10-12T10:00:00.000Z"),
        now: NOW,
      })
    ).toBe(true)
  })

  it("keeps an order that was still open earlier today", () => {
    expect(
      missingDayOrderShouldExpire({
        status: "ACCEPTED",
        validity: "DAY",
        filledQty: 0,
        updatedAt: new Date("2026-10-13T03:46:00.000Z"), // 09:16 IST today
        now: NOW,
      })
    ).toBe(false)
  })

  it("does not expire a partial fill", () => {
    expect(
      missingDayOrderShouldExpire({
        status: "PARTIALLY_FILLED",
        validity: "DAY",
        filledQty: 65,
        updatedAt: new Date("2026-10-09T10:00:00.000Z"),
        now: NOW,
      })
    ).toBe(false)
  })

  it("does not expire when validity is blank or the row is already terminal", () => {
    expect(
      missingDayOrderShouldExpire({
        status: "ACCEPTED",
        validity: null,
        filledQty: 0,
        updatedAt: new Date("2026-10-09T10:00:00.000Z"),
        now: NOW,
      })
    ).toBe(false)
    expect(
      missingDayOrderShouldExpire({
        status: "CANCELLED",
        validity: "DAY",
        filledQty: 0,
        updatedAt: new Date("2026-10-09T10:00:00.000Z"),
        now: NOW,
      })
    ).toBe(false)
  })

  it("does not expire an order last seen at the start of today", () => {
    expect(
      missingDayOrderShouldExpire({
        status: "UNKNOWN",
        validity: "DAY",
        filledQty: 0,
        updatedAt: new Date("2026-10-12T18:30:00.000Z"), // 00:00 IST 13 Oct
        now: NOW,
      })
    ).toBe(false)
  })
})
