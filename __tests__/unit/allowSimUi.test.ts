import { isSimUiAllowed } from "../../lib/simulation/allowSimUi"

describe("isSimUiAllowed", () => {
  const env = process.env

  afterEach(() => {
    process.env = { ...env }
  })

  it("allows non-production", () => {
    process.env.NODE_ENV = "test"
    expect(isSimUiAllowed()).toBe(true)
  })

  it("blocks production without flag", () => {
    process.env.NODE_ENV = "production"
    delete process.env.ALLOW_SIM_UI
    expect(isSimUiAllowed()).toBe(false)
  })

  it("allows production with ALLOW_SIM_UI=true", () => {
    process.env.NODE_ENV = "production"
    process.env.ALLOW_SIM_UI = "true"
    expect(isSimUiAllowed()).toBe(true)
  })
})
