import { expect, authenticatedTest as test } from "./fixtures"

test("today list keeps kill switches with the trades", async ({ page }) => {
  await page.goto("/desk?tab=today")
  const kill = page.getByRole("button", { name: /square off all open/i })
  await expect(kill).toBeVisible({ timeout: 20_000 })
  const killBox = await kill.boundingBox()
  const details = page.getByRole("button", { name: "Details" }).first()
  if (await details.count()) {
    const detailsBox = await details.boundingBox()
    expect(killBox && detailsBox && killBox.y < detailsBox.y).toBeTruthy()
  }
})

test("template expiry says current week", async ({ page }) => {
  await page.goto("/templates?type=ATM_STRADDLE")
  await page.getByRole("button", { name: "New straddle" }).click()
  await expect(page.getByText(/current week expiry/i)).toBeVisible({ timeout: 20_000 })
})
