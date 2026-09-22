import { formatThrownMessage } from "../../lib/kiteError"

describe("formatThrownMessage", () => {
  it("reads Kite's plain error object instead of [object Object]", () => {
    const thrown = {
      status: "error",
      message:
        "No IPs configured for this app. Add allowed IPs on the Kite developer console.",
      error_type: "PermissionException",
      data: null,
    }
    expect(String(thrown)).toBe("[object Object]")
    expect(formatThrownMessage(thrown)).toBe(
      "PermissionException: No IPs configured for this app. Add allowed IPs on the Kite developer console."
    )
  })

  it("keeps Error messages and non-empty strings", () => {
    expect(formatThrownMessage(new Error("socket hang up"))).toBe("socket hang up")
    expect(formatThrownMessage("  margin short  ")).toBe("margin short")
  })

  it("falls back when the throw has no message", () => {
    expect(formatThrownMessage(null)).toBe("Unknown error")
    expect(formatThrownMessage({ status: "error" }, "broker rejected")).toBe("broker rejected")
  })
})
