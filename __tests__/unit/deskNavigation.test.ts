import { migrateLegacyTab, parseDeskRoute } from "../../lib/deskNavigation"

describe("deskNavigation", () => {
  it("maps legacy tabs to views", () => {
    expect(migrateLegacyTab("positions")).toEqual({ view: "books", tab: "positions" })
    expect(migrateLegacyTab("today")).toEqual({ view: "now", tab: "today" })
    expect(migrateLegacyTab(undefined)).toEqual({ view: "now", tab: "today" })
  })

  it("parses view query", () => {
    expect(parseDeskRoute({ view: "books", tab: "orders" })).toEqual({
      view: "books",
      tab: "orders",
    })
  })
})
