import { expect, test } from "@playwright/test"

import {
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  gotoAndSettle,
} from "../helpers"

// Development server with sample data enabled. Sample data must always be
// labelled as such.

test("orders preview is labelled and uses PRV- references", async ({ page }) => {
  await gotoAndSettle(page, "/orders")
  await expect(page.getByRole("note").filter({ hasText: /preview data/i }).first()).toBeVisible()
  // The list is a table on desktop and cards on mobile; check whichever is shown.
  await expect(page.getByText(/PRV-\d+/).filter({ visible: true }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
})

test("order detail preview", async ({ page }) => {
  await gotoAndSettle(page, "/orders")
  await page.getByRole("link", { name: /PRV-\d+/ }).filter({ visible: true }).first().click()
  await page.waitForLoadState("networkidle")
  await expect(page.getByRole("heading", { level: 1, name: /PRV-\d+/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
})

test("menu preview is labelled", async ({ page }) => {
  await gotoAndSettle(page, "/menu")
  await expect(page.getByRole("note").first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
})

test("categories preview", async ({ page }) => {
  await gotoAndSettle(page, "/menu/categories")
  await expect(page.getByRole("heading", { level: 1, name: /categories/i })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
})
