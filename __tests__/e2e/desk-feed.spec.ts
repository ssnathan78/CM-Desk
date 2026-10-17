import { expect, authenticatedTest as test } from "./fixtures"

test.describe("Desk Signals and Alerts", () => {
  test("Signals tab loads the persisted evaluation panel", async ({ page }) => {
    await page.goto("/desk?tab=signals")
    await expect(page.getByRole("tab", { name: /signals/i })).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText(/persisted evaluation|chase hourly|waiting for signal|no signals/i).first()
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /clear today/i })).toBeVisible()
    await expect(page.getByLabel(/strategy/i).first()).toBeVisible()
  })

  test("Alerts tab has period filters and clear actions", async ({ page }) => {
    await page.goto("/desk?tab=alerts")
    await expect(page.getByRole("tab", { name: /alerts/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("button", { name: /clear today/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /clear all/i })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Period" })).toHaveText(/Today/)
  })

  test("alert code links open Why decisions when present", async ({ page }) => {
    await page.goto("/desk?view=why&tab=alerts")
    await expect(page.getByRole("tab", { name: /alerts/i })).toBeVisible({ timeout: 20_000 })
    const link = page.getByRole("link", { name: /market closed|order rejected|risk/i }).first()
    if (await link.isVisible().catch(() => false)) {
      await link.click()
      await expect(page).toHaveURL(/view=why.*tab=decisions|tab=orders|tab=signals/)
    }
  })
})
