import { validateTemplateLotsInput, validateTemplateTimes } from "../../lib/forms/templateSchema"

describe("templateSchema", () => {
  it("rejects zero lots", () => {
    expect(validateTemplateLotsInput("0")).toMatch(/whole number/)
  })

  it("accepts positive lots", () => {
    expect(validateTemplateLotsInput("2")).toBeNull()
  })

  it("requires ASO after run", () => {
    expect(validateTemplateTimes("09:20", "09:15")).toMatch(/after run/)
  })
})
