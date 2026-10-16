import { operatorJobError } from "../../lib/operatorJobError"

describe("operator job errors", () => {
  it("replaces Kite's token string", () => {
    expect(operatorJobError("Incorrect `api_key` or `access_token`.")).toMatch(/Sign in again/)
    expect(operatorJobError("Exchange is offline right now.")).toMatch(/offline/)
    expect(operatorJobError("[atmStraddle] too many skew/network retries — fail closed")).toMatch(
      /no order was sent/
    )
    expect(
      operatorJobError("[atmStraddle] time expired and takeTradeIrrespectiveSkew is false")
    ).toMatch(/reject the trade/)
  })
})
