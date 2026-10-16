import { expect, authenticatedTest as test } from "./fixtures"

test.describe("Templates", () => {
  test("save and run now create a Today job without requiring Schedule now", async ({ page }) => {
    page.on("dialog", dialog => dialog.accept())
    await page.goto("/templates?type=ATM_STRADDLE")
    await page.getByRole("button", { name: "New straddle" }).click()
    await page.getByLabel("Template name").fill(`E2E ${Date.now()}`)
    await page.getByRole("button", { name: "Save template" }).click()
    await expect(page.getByRole("heading", { name: /Editing template E2E/ })).toBeVisible()
    await expect(page.getByText(/could not save|tick at least one index/i)).toHaveCount(0)
    await page.getByRole("button", { name: "Run now" }).click()
    await page.waitForURL(/\/desk/, { timeout: 20_000 })
    await expect(page.getByRole("tab", { name: "Today", exact: true })).toBeVisible()
  })
})

test.describe("Schedules", () => {
  test("Plan lists weekday schedules", async ({ page }) => {
    await page.goto("/plan")
    await expect(page.getByRole("heading", { name: "Schedules" })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("heading", { name: "MONDAY" })).toBeVisible()
  })

  test("Today can schedule a due template", async ({ page }) => {
    const name = `Due ${Date.now()}`
    const saved = await page.request.post("/api/templates", {
      data: {
        config: {
          strategy: "ATM_STRADDLE",
          name,
          instrument: "NIFTY",
          lots: 1,
          volatilityType: "SHORT",
          productType: "MIS",
          expiryType: "CURRENT",
          exitStrategy: "INDIVIDUAL_LEG_SLM_1X",
          slmPercent: 30,
          maxSkewPercent: 10,
          thresholdSkewPercent: 20,
          isAutoSquareOffEnabled: true,
        },
      },
    })
    const body = await saved.json()
    const day = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    }).toUpperCase()
    await page.request.post("/api/schedules", {
      data: { templateId: body.id, dayOfWeek: day, enabled: true },
    })
    await page.goto("/desk?tab=today")
    await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 })
    await page
      .locator("div")
      .filter({ has: page.getByText(name, { exact: false }) })
      .getByRole("button", { name: "Schedule" })
      .last()
      .click()
    await expect(page.getByText(name)).toBeHidden({ timeout: 20_000 })
  })
})
