import { inferOrderRole } from "../../../lib/trading/riskEngine"
import { storedOrderPurpose } from "../../../lib/trading/orderPurpose"

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
