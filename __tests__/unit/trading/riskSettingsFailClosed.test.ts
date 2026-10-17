jest.mock("../../../lib/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

jest.mock("../../../lib/trading/ledger", () => ({
  recordAuditEvent: jest.fn(),
}))

jest.mock("../../../lib/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            throw new Error("db down")
          },
        }),
      }),
    }),
  },
}))

describe("getRiskSettings fail closed", () => {
  it("throws instead of treating every strategy as paper", async () => {
    const { getRiskSettings, RiskSettingsUnavailableError } = await import(
      "../../../lib/trading/riskSettings"
    )
    await expect(getRiskSettings()).rejects.toBeInstanceOf(RiskSettingsUnavailableError)
  })
})
