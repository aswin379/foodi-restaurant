import { expect, test } from "@playwright/test"

import {
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  gotoAndSettle,
} from "../helpers"

// Production build with no data-source variables: every module must show its
// "not connected" state, and no sample data or preview label may appear.

const routes = [
  { path: "/login", heading: /welcome back/i },
  { path: "/dashboard", heading: /welcome to your restaurant dashboard/i },
  { path: "/orders", heading: /^orders$/i, disconnected: /orders aren.t connected yet/i },
  { path: "/orders/history", heading: /order history/i, disconnected: /orders aren.t connected yet/i },
  { path: "/orders/prv-1003", heading: null, disconnected: /orders aren.t connected yet/i },
  { path: "/menu", heading: /menu/i, disconnected: /menu isn.t connected yet/i },
  { path: "/menu/new", heading: /add (a )?(menu )?item|new item/i },
  { path: "/menu/categories", heading: /categories/i, disconnected: /categories aren.t connected yet/i },
]

for (const route of routes) {
  test.describe(route.path, () => {
    test("renders without sample data, overflow or serious accessibility issues", async ({ page }) => {
      await gotoAndSettle(page, route.path)

      if (route.heading) {
        await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible()
      }
      if (route.disconnected) {
        await expect(page.getByText(route.disconnected).first()).toBeVisible()
      }

      const body = page.locator("body")
      await expect(body).not.toContainText("PRV-")
      await expect(body).not.toContainText(/preview only, not saved to foodi/i)
      await expect(body).not.toContainText(/illustrative preview data|sample (menu|data)/i)

      await expectNoHorizontalOverflow(page)
      await expectNoSeriousA11yViolations(page)
      expectNoConsoleErrors(page)
    })
  })
}

test("the print view shows no preview data in production", async ({ page }) => {
  await gotoAndSettle(page, "/print/orders/prv-1003")
  await expect(page.getByText(/orders aren.t connected yet/i).first()).toBeVisible()
  await expect(page.locator("body")).not.toContainText(/PRV-|sample data/i)
  expectNoConsoleErrors(page)
})

test("the board offers no preview tools in production", async ({ page }) => {
  await gotoAndSettle(page, "/orders")
  await expect(page.getByRole("button", { name: /simulate a new order|reset sample orders/i })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^accept/i })).toHaveCount(0)
})

test("fixture preview scenarios are ignored in production", async ({ page }) => {
  await gotoAndSettle(page, "/orders?preview=slow")
  await expect(page.getByText(/orders aren.t connected yet/i).first()).toBeVisible()
  await expect(page.locator("body")).not.toContainText("PRV-")
})

test("navigation links only to built modules", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard")
  const nav = page.getByRole("navigation", { name: "Restaurant admin" }).first()
  // On small screens the sidebar is in a drawer.
  if (!(await nav.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click()
  }
  const visibleNav = page.getByRole("navigation", { name: "Restaurant admin" }).filter({ visible: true })
  const hrefs = await visibleNav.getByRole("link").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href"))
  )
  expect(hrefs.sort()).toEqual(["/dashboard", "/menu", "/menu/categories", "/orders"])
  await expect(visibleNav.getByText("Availability & hours")).toBeVisible()
  await expect(visibleNav).not.toContainText(/POS|QR/)
})
