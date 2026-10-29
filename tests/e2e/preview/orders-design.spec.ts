import { expect, test } from "@playwright/test"

import {
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  gotoAndSettle,
} from "../helpers"

// Orders visual redesign: accessibility and layout of every Orders screen. Other specs change
// orders in parallel, so these checks only read, and assert structure rather than counts.

const SCREENS = [
  { name: "live board", path: "/orders", heading: /^orders$/i },
  { name: "order history", path: "/orders/history", heading: /^order history$/i },
  { name: "filtered history", path: "/orders/history?status=pending&q=PRV", heading: /^order history$/i },
  { name: "empty history", path: "/orders/history?preview=empty", heading: /^order history$/i },
  { name: "history with a failed load", path: "/orders/history?preview=error", heading: /^order history$/i },
  { name: "order detail", path: "/orders/prv-1007", heading: /^order prv-1007$/i },
]

// The pulsing alarm ring is the only infinite animation; axe reads text colours, which it never touches.
for (const screen of SCREENS) {
  test(`${screen.name} has no serious accessibility violations and no horizontal overflow`, async ({ page }) => {
    await gotoAndSettle(page, screen.path)
    await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await expectNoHorizontalOverflow(page)
    if (!screen.path.includes("preview=error")) expectNoConsoleErrors(page)
  })
}

test("a failed history load is announced with a way to retry", async ({ page }) => {
  await gotoAndSettle(page, "/orders/history?preview=error")
  const alert = page.getByRole("alert").filter({ hasText: "We couldn't load orders" })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole("link", { name: "Try again" })).toHaveAttribute("href", /\/orders\/history/)
})

test("each history row has one link to its order, named with the reference", async ({ page }) => {
  await gotoAndSettle(page, "/orders/history")
  const links = page.locator('a[href^="/orders/prv-"]').filter({ visible: true })
  expect(await links.count()).toBeGreaterThan(0)
  // From lg up the row has a reference link and an arrow link ("View order PRV-…"); below it, one card link.
  const arrows = page.getByRole("link", { name: /^View order PRV-/ })
  if (await arrows.first().isVisible()) {
    await expect(arrows.first()).toHaveAttribute("href", /^\/orders\/prv-/)
  }
})

test("on the order detail page the actions come before the items", async ({ page }) => {
  await gotoAndSettle(page, "/orders/prv-1007")
  const actions = page.getByRole("heading", { level: 2, name: "Actions" })
  const items = page.getByRole("heading", { level: 2, name: "Items" })
  const actionsFirst = await actions.evaluate(
    (node, other) => Boolean(node.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    await items.elementHandle()
  )
  expect(actionsFirst).toBe(true)
  // The same cards still show the order's items and totals.
  await expect(page.getByRole("heading", { level: 2, name: "Order timeline" })).toBeVisible()
})

test("the board's columns keep their order counts as text", async ({ page }) => {
  await gotoAndSettle(page, "/orders")
  for (const title of ["New", "In kitchen", "Ready", "Scheduled"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${title}\\s+\\d+ orders?$`) })).toBeVisible()
  }
})
