import { inferOrderRole } from "../../../lib/trading/riskEngine"
import {
  exitReasonForOrderPurpose,
  shouldRecordOrderStatusEvent,
  storedOrderPurpose,
} from "../../../lib/trading/orderPurpose"

describe("storedOrderPurpose", () => {
  it("stores a cover as EXIT and still classifies the risk role as flatten", () => {
    expect(storedOrderPurpose("FLATTEN")).toBe("EXIT")
    expect(storedOrderPurpose("flatten")).toBe("EXIT")
    expect(storedOrderPurpose("EXIT")).toBe("EXIT")
    expect(storedOrderPurpose("SL")).toBe("SL")
    expect(inferOrderRole({ purpose: "FLATTEN" })).toBe("FLATTEN")
    expect(inferOrderRole({ purpose: "EXIT" })).toBe("EXIT")
  })
})

describe("exitReasonForOrderPurpose", () => {
  it("labels a protective stop and leaves other purposes unlabeled", () => {
    expect(exitReasonForOrderPurpose("SL")).toBe("STOP_LOSS")
    expect(exitReasonForOrderPurpose("ENTRY")).toBeUndefined()
    expect(exitReasonForOrderPurpose("EXIT")).toBeUndefined()
    expect(exitReasonForOrderPurpose(null)).toBeUndefined()
  })
})

describe("shouldRecordOrderStatusEvent", () => {
  it("records a real transition and ignores a repeat of an already filled order", () => {
    expect(shouldRecordOrderStatusEvent("ACCEPTED", "FILLED")).toBe(true)
    expect(shouldRecordOrderStatusEvent("FILLED", undefined)).toBe(false)
    expect(shouldRecordOrderStatusEvent("FILLED", "FILLED")).toBe(false)
    expect(shouldRecordOrderStatusEvent("PARTIALLY_FILLED", "PARTIALLY_FILLED")).toBe(false)
    expect(shouldRecordOrderStatusEvent("ACCEPTED", "CANCELLED")).toBe(true)
  })
})
