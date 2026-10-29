import { expect, test } from "@playwright/test"

import {
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  gotoAndSettle,
} from "../helpers"

// Menu visual redesign: accessibility and layout of the Menu screens. Other specs change the
// sample menu in parallel, so these checks only read, and assert structure rather than counts.

const SCREENS = [
  { name: "item list", path: "/menu", heading: /^menu$/i },
  { name: "sold-out filter", path: "/menu?filter=sold_out", heading: /^menu$/i },
  { name: "empty menu", path: "/menu?preview=empty", heading: /^menu$/i },
  { name: "failed item load", path: "/menu?preview=error", heading: /^menu$/i },
  { name: "add item", path: "/menu/new", heading: /^add menu item$/i },
  { name: "categories", path: "/menu/categories", heading: /^categories$/i },
  { name: "meal periods", path: "/menu/meal-periods", heading: /^meal periods$/i },
]

for (const screen of SCREENS) {
  test(`${screen.name} has no serious accessibility violations and no horizontal overflow`, async ({ page }) => {
    await gotoAndSettle(page, screen.path)
    await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await expectNoHorizontalOverflow(page)
    if (!screen.path.includes("preview=error")) expectNoConsoleErrors(page)
  })
}

test("the item editor has no serious accessibility violations and no horizontal overflow", async ({ page }) => {
  await gotoAndSettle(page, "/menu")
  const edit = page.locator('a[href^="/menu/prv-"][href$="/edit"]').filter({ visible: true }).first()
  await edit.click()
  await expect(page.getByRole("heading", { level: 1, name: /^Edit / })).toBeVisible()
  await page.waitForLoadState("networkidle")
  await expectNoSeriousA11yViolations(page)
  await expectNoHorizontalOverflow(page)
})

test("the sold-out dialog opens from the availability switch and has no serious accessibility violations", async ({
  page,
}) => {
  await gotoAndSettle(page, "/menu?filter=available")
  await page.getByRole("switch", { name: /^Available:/ }).filter({ visible: true }).first().click()
  const dialog = page.getByRole("alertdialog", { name: /sold out\?$/ })
  await expect(dialog).toBeVisible()
  // Let the open animation finish so axe measures the final colours.
  await page.waitForTimeout(500)
  await expectNoSeriousA11yViolations(page)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})

test("a failed item load is announced with a way to retry", async ({ page }) => {
  await gotoAndSettle(page, "/menu?preview=error")
  const alert = page.getByRole("alert").filter({ hasText: "We couldn't load menu items" })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole("link", { name: "Try again" })).toHaveAttribute("href", /\/menu/)
})

test("each menu row shows its price and a status as text, with an availability switch", async ({ page }) => {
  await gotoAndSettle(page, "/menu")
  const switches = page.getByRole("switch", { name: /^Available:/ }).filter({ visible: true })
  expect(await switches.count()).toBeGreaterThan(0)
  // Status is a word, never colour alone; the price is a rupee amount.
  await expect(page.getByText(/^(Available|Sold out)/).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText(/₹\s?\d/).filter({ visible: true }).first()).toBeVisible()
})

test("every status filter is fully visible without scrolling, and keeps its name", async ({ page }) => {
  await gotoAndSettle(page, "/menu")
  const viewport = page.viewportSize()!
  const nav = page.getByRole("navigation", { name: "Filter items by status" })
  for (const label of ["All items", "Available", "Sold out", "Archived"]) {
    const link = nav.getByRole("link", { name: label, exact: true })
    await expect(link).toBeVisible()
    const box = (await link.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1)
})
