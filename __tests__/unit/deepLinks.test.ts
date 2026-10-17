import { alertTarget, hrefForDeskLink } from "../../lib/desk/deepLinks"

describe("alertTarget", () => {
  it("routes recon to broker setup", () => {
    const link = alertTarget({ source: "RECON", code: "RECONCILIATION_MISMATCH" })
    expect(link.query).toEqual({ view: "setup", tab: "broker" })
  })

  it("routes risk to decisions", () => {
    const link = alertTarget({ source: "RISK", code: "LIVE_BLOCKED" })
    expect(link.query.tab).toBe("decisions")
  })

  it("routes order to orders blotter", () => {
    const link = alertTarget({
      source: "ORDER",
      code: "ORDER_REJECTED",
      orderId: "ord-1",
    })
    expect(link.query).toMatchObject({ tab: "orders", orderId: "ord-1" })
  })

  it("routes job to signals filter", () => {
    const link = alertTarget({
      source: "JOB",
      code: "JOB_FAILED",
      jobId: "job-9",
    })
    expect(link.query).toEqual({ view: "why", tab: "signals", jobId: "job-9" })
  })
})

describe("hrefForDeskLink", () => {
  it("builds query string", () => {
    expect(
      hrefForDeskLink({ pathname: "/desk", query: { view: "why", tab: "alerts" } })
    ).toBe("/desk?view=why&tab=alerts")
  })
})
