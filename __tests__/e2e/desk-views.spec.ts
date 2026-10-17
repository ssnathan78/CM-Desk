import { expect, authenticatedTest as test } from "./fixtures"

test.describe("desk views", () => {
  test("legacy tab redirects to canonical view", async ({ page }) => {
    await page.goto("/desk?tab=positions")
    await expect(page).toHaveURL(/view=books/)
    await expect(page).toHaveURL(/tab=positions/)
  })

  test("now view loads strategy board", async ({ page }) => {
    await page.goto("/desk?view=now&tab=today")
    await expect(page.getByText("Strategy board")).toBeVisible()
  })

  test("books positions visible on compact viewport", async ({ page }) => {
    await page.setViewportSize({ width: 682, height: 700 })
    await page.goto("/desk?view=books&tab=positions")
    await expect(page.getByRole("columnheader", { name: "Symbol" })).toBeVisible()
    const headerBottom = await page.getByRole("banner").boundingBox()
    const symbolHeader = await page.getByRole("columnheader", { name: "Symbol" }).boundingBox()
    expect(headerBottom).toBeTruthy()
    expect(symbolHeader).toBeTruthy()
    if (headerBottom && symbolHeader) {
      expect(symbolHeader.y).toBeGreaterThan(headerBottom.y + headerBottom.height - 4)
    }
  })
})
