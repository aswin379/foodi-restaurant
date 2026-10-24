import { expect, test } from "@playwright/test"

import {
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  gotoAndSettle,
} from "../helpers"

// Development server with preview data enabled. Preview data must always be
// labelled as such; these checks only read pages.

const PREVIEW_LABEL = /preview only, not saved to foodi/i

const pages = [
  { name: "orders board", path: "/orders", heading: /^orders$/i },
  { name: "order history", path: "/orders/history", heading: /order history/i },
  { name: "order detail", path: "/orders/prv-1007", heading: /order prv-1007/i },
  { name: "order print view", path: "/print/orders/prv-1007", heading: /kitchen ticket and bill/i },
  { name: "menu", path: "/menu", heading: /menu/i },
  { name: "menu item editor", path: "/menu/prv-item-13/edit", heading: /edit veg biryani/i },
  { name: "scheduled item editor", path: "/menu/prv-item-14/edit", heading: /edit chicken biryani/i },
  { name: "all-day item editor", path: "/menu/prv-item-19/edit", heading: /edit filter coffee/i },
  { name: "new menu item", path: "/menu/new", heading: /add menu item/i },
  { name: "categories", path: "/menu/categories", heading: /categories/i },
]

for (const { name, path, heading } of pages) {
  test(`${name} renders accessibly without overflow or console errors`, async ({ page }) => {
    await gotoAndSettle(page, path)
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeAttached()
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
    expectNoConsoleErrors(page)
  })
}

test("orders pages label preview data and use PRV- references", async ({ page }) => {
  for (const path of ["/orders", "/orders/history", "/orders/prv-1007"]) {
    await gotoAndSettle(page, path)
    await expect(page.getByRole("note").filter({ hasText: PREVIEW_LABEL }).first()).toBeVisible()
    // The history is a table on desktop and cards on mobile; check whichever is shown.
    await expect(page.getByText(/PRV-\d+/).filter({ visible: true }).first()).toBeVisible()
  }
  await gotoAndSettle(page, "/print/orders/prv-1007")
  await expect(page.getByText(/preview · sample data · not a real order/i).first()).toBeVisible()
})

test("order history filters by status", async ({ page }) => {
  await gotoAndSettle(page, "/orders/history?status=completed")
  // Status badges are spans; the filter tabs above them are links.
  const badges = (pattern: string) =>
    page.locator(`main span:text-matches("${pattern}")`).filter({ visible: true })
  await expect(badges("^Completed$").first()).toBeVisible()
  await expect(badges("^(Scheduled|New|Accepted|Ready|Out for delivery|Rejected|Cancelled)$")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Completed", exact: true })).toHaveAttribute("aria-current", "page")
})

test("menu pages label preview data", async ({ page }) => {
  for (const path of ["/menu", "/menu/new", "/menu/prv-item-13/edit", "/menu/categories"]) {
    await gotoAndSettle(page, path)
    await expect(page.getByRole("note").filter({ hasText: PREVIEW_LABEL }).first()).toBeVisible()
  }
})
