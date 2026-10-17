import { firstTemplateTradeFormError } from "../../lib/forms/templateTradeFormSchema"

describe("templateTradeFormSchema", () => {
  it("rejects empty template name", () => {
    const err = firstTemplateTradeFormError({
      name: "",
      lots: 1,
      instruments: { NIFTY: true },
      runAt: "09:20",
      isAutoSquareOffEnabled: false,
    })
    expect(err).toMatch(/name/i)
  })

  it("rejects ASO before run time", () => {
    const err = firstTemplateTradeFormError({
      name: "Test",
      lots: 1,
      instruments: { NIFTY: true },
      runAt: "10:00",
      squareOffTime: "09:30",
      isAutoSquareOffEnabled: true,
    })
    expect(err).toMatch(/square-off|after run/i)
  })
})
