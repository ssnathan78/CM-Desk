import { expect, authenticatedTest as test } from "./fixtures"

test.describe("Desk home", () => {
  test("dashboard redirects to Desk and shows Today", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/desk/)
    await expect(page.getByText("Today", { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: /plan/i }).first()).toBeVisible()
  })

  test("Broker tab shows reconcile and attribute", async ({ page }) => {
    await page.goto("/desk?tab=broker")
    await expect(page.getByRole("button", { name: /reconcile with broker/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/attribute broker quantity/i)).toBeVisible()
  })
})
