import AxeBuilder from "@axe-core/playwright"

import { expect, authenticatedTest as test } from "./fixtures"

test.describe("Accessibility", () => {
  test("dashboard has no critical axe violations", async ({ page }) => {
    await page.goto("/desk")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("plan page has no critical axe violations", async ({ page }) => {
    await page.goto("/plan")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("chase page has no critical axe violations", async ({ page }) => {
    await page.goto("/chase")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("risk page has no critical axe violations", async ({ page }) => {
    await page.goto("/risk")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("momentum page has no critical axe violations", async ({ page }) => {
    await page.goto("/momentum")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("daily trend page has no critical axe violations", async ({ page }) => {
    await page.goto("/daily-trend")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("templates page has no critical axe violations", async ({ page }) => {
    await page.goto("/templates")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("desk books positions has no critical axe violations", async ({ page }) => {
    await page.goto("/desk?view=books&tab=positions")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })

  test("desk books trades has no critical axe violations", async ({ page }) => {
    await page.goto("/desk?view=books&tab=trades")
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === "critical")
    expect(critical).toEqual([])
  })
})
