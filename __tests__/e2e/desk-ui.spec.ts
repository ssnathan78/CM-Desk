import { expect, authenticatedTest as test } from "./fixtures"

test.describe("Follow-through pages", () => {
  test("momentum splits rebalance from drift cash", async ({ page }) => {
    await page.goto("/momentum")
    await expect(page.getByRole("button", { name: "Preview orders" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole("heading", { name: "Rebalance" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Drift cash" })).toHaveCount(0)
    await page.getByLabel("Weights").click()
    await page.getByRole("option", { name: "Let winners run" }).click()
    await page.getByRole("button", { name: "Drift cash" }).click()
    await expect(page.getByRole("button", { name: "Preview deploy" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Preview trim" })).toBeVisible()
  })

  test("daily trend has a guide and constituent refresh", async ({ page }) => {
    await page.goto("/daily-trend")
    const guide = page.getByRole("main").getByRole("link", { name: "Guide" })
    await expect(guide).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("button", { name: "Refresh constituents" })).toBeVisible()
    await guide.click()
    await expect(page).toHaveURL(/\/help\/daily-trend/)
    await expect(
      page.getByRole("heading", { level: 1, name: "Daily long-only trend" })
    ).toBeVisible()
  })

  test("chase keeps inline fields and uses icon actions", async ({ page }) => {
    await page.goto("/chase")
    await expect(page.getByRole("columnheader", { name: "EMA", exact: true })).toBeVisible({
      timeout: 30_000,
    })
    const lots = page.getByRole("row", { name: /^NIFTY\b/ }).getByRole("spinbutton").first()
    const currentLots = await lots.inputValue()
    await lots.fill(currentLots === "2" ? "3" : "2")
    await expect(page.getByRole("button", { name: "Save unsaved changes" }).first()).toBeVisible()
    const reset = page.getByRole("button", { name: "Reset status" })
    await expect(reset.first()).toBeVisible()
    await reset.first().hover()
    await expect(page.getByRole("tooltip")).toContainText(/clears long or short/i)
  })
})
