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
  { path: "/dashboard", heading: /welcome to your restaurant dashboard/i, disconnected: /hours aren.t connected yet/i },
  { path: "/orders", heading: /^orders$/i, disconnected: /orders aren.t connected yet/i },
  { path: "/orders/history", heading: /order history/i, disconnected: /orders aren.t connected yet/i },
  { path: "/orders/prv-1003", heading: null, disconnected: /orders aren.t connected yet/i },
  { path: "/menu", heading: /menu/i, disconnected: /menu isn.t connected yet/i },
  { path: "/menu/new", heading: /add menu item/i, disconnected: /categories aren.t connected yet/i },
  { path: "/menu/prv-item-01/edit", heading: null, disconnected: /menu isn.t connected yet/i },
  { path: "/menu/categories", heading: /categories/i, disconnected: /categories aren.t connected yet/i },
  { path: "/menu/meal-periods", heading: /meal periods/i, disconnected: /meal periods aren.t connected yet/i },
  { path: "/hours", heading: /availability & hours/i, disconnected: /hours aren.t connected yet/i },
  { path: "/settings", heading: /^settings$/i },
  { path: "/settings/profile", heading: /restaurant profile/i, disconnected: /settings aren.t connected yet/i },
  { path: "/settings/orders", heading: /order settings/i, disconnected: /settings aren.t connected yet/i },
  { path: "/hours/special-dates", heading: /availability & hours/i, disconnected: /hours aren.t connected yet/i },
  { path: "/reviews", heading: /^reviews$/i, disconnected: /reviews aren.t connected yet/i },
  { path: "/reviews?rating=5&replied=unreplied&page=2", heading: /^reviews$/i, disconnected: /reviews aren.t connected yet/i },
  { path: "/reviews/prv-rev-005", heading: null, disconnected: /reviews aren.t connected yet/i },
  { path: "/customers", heading: /^customers$/i, disconnected: /customers aren.t connected yet/i },
  { path: "/customers?q=preview&sort=name&page=2", heading: /^customers$/i, disconnected: /customers aren.t connected yet/i },
  { path: "/customers?preview=empty", heading: /^customers$/i, disconnected: /customers aren.t connected yet/i },
  { path: "/customers/prv-cus-01", heading: null, disconnected: /customers aren.t connected yet/i },
  { path: "/wallet", heading: /^wallet & settlements$/i, disconnected: /wallet isn.t connected yet/i },
  { path: "/wallet/settlements", heading: /^settlements$/i, disconnected: /wallet isn.t connected yet/i },
  { path: "/wallet/settlements?page=2", heading: /^settlements$/i, disconnected: /wallet isn.t connected yet/i },
  { path: "/wallet/settlements/prv-set-01", heading: null, disconnected: /wallet isn.t connected yet/i },
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
      await expect(body).not.toContainText(/preview customer/i)
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

test("the menu offers no preview tools or item controls in production", async ({ page }) => {
  await gotoAndSettle(page, "/menu")
  await expect(page.getByRole("button", { name: /reset sample menu/i })).toHaveCount(0)
  await expect(page.getByRole("switch")).toHaveCount(0)
  await gotoAndSettle(page, "/menu/categories")
  await expect(page.getByRole("button", { name: /move .* up/i })).toHaveCount(0)
  // No editor, so no schedule can be set or saved.
  await gotoAndSettle(page, "/menu/new")
  await expect(page.getByRole("radio", { name: /only at set times/i })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /add item/i })).toHaveCount(0)
  // No meal periods, no editor for them, and no hours check (B3b).
  await gotoAndSettle(page, "/menu/meal-periods")
  await expect(page.getByRole("button", { name: /add meal period|archive|restore|delete/i })).toHaveCount(0)
  await expect(page.locator("body")).not.toContainText(/used by|07:00–11:00|check against restaurant hours/i)
})

test("hours offer no preview tools, editor, pause or estimate in production", async ({ page }) => {
  for (const path of ["/hours", "/hours/special-dates", "/hours?preview=slow"]) {
    await gotoAndSettle(page, path)
    await expect(page.getByText(/hours aren.t connected yet/i).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /reset sample hours|pause new orders|save hours|add special date|resume/i })).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(/preview estimate|\(preview\)/i)
  }
  await gotoAndSettle(page, "/dashboard")
  await expect(page.getByRole("region", { name: /restaurant paused/i })).toHaveCount(0)
  await expect(page.getByRole("region", { name: /new orders right now/i })).toHaveCount(0)
})

test("the dashboard shows no figures, sample data or placeholders in production", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard?previewOrders=slow&previewMenu=empty&previewHours=error"]) {
    await gotoAndSettle(page, path)
    const main = page.locator("main")
    for (const name of ["Live orders", "Today's orders", "Recent orders"]) {
      await expect(page.getByRole("region", { name: new RegExp(`^${name}`) })).toContainText(/orders aren.t connected yet/i)
    }
    const attention = page.getByRole("region", { name: /^Needs attention/ })
    await expect(attention).toContainText("Not checked: Pause status (not connected yet).")
    await expect(attention).toContainText("Not checked: Waiting, late and unavailable-item orders (not connected yet).")
    await expect(attention).toContainText("Not checked: Sold-out menu items (not connected yet).")
    await expect(attention).not.toContainText(/nothing needs attention/i)
    await expect(main).not.toContainText(/preview:|preview estimate|\(preview\)|\bSoon\b/i)
    // No counts at all: the only links in the order sections would be counts.
    await expect(page.getByRole("region", { name: /^Live orders/ }).getByRole("link")).toHaveCount(0)
    await expect(page.getByRole("region", { name: /^Today's orders/ }).getByRole("link")).toHaveCount(0)
    expect(
      await page.getByRole("region", { name: "Quick links" }).getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    ).toEqual(["/orders", "/menu", "/hours", "/settings/profile", "/settings/orders"])
  }
})

test("settings offer no preview tools, forms or sample data in production", async ({ page }) => {
  for (const path of ["/settings/profile", "/settings/orders", "/settings/profile?preview=forbidden"]) {
    await gotoAndSettle(page, path)
    await expect(page.getByText(/settings aren.t connected yet/i).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /reset sample settings|save profile|save order settings/i })).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(/\(preview\)|sample street|₹150/i)
  }
})

test("reviews show no sample reviews, figures, controls or preview tools in production", async ({ page }) => {
  const paths = [
    "/reviews",
    "/reviews?rating=5&replied=unreplied&page=2",
    "/reviews?preview=slow",
    "/reviews?preview=empty",
    "/reviews?preview=error",
    "/reviews?preview=forbidden",
    "/reviews/prv-rev-005",
    "/reviews/prv-rev-005?preview=forbidden",
    "/reviews/prv-rev-999?preview=empty",
  ]
  for (const path of paths) {
    await gotoAndSettle(page, path)
    // Whatever the URL asks for, production is not connected: never empty, failed, refused or "not found".
    await expect(page.getByText(/reviews aren.t connected yet/i).first()).toBeVisible()
    // (Next's own route announcer is an empty alert, so look for one with text.)
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /send reply|report abuse|submit report|reset sample reviews/i })).toHaveCount(0)
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(page.getByRole("switch")).toHaveCount(0)
    await expect(page.getByRole("radio")).toHaveCount(0)
    await expect(page.getByRole("img", { name: /out of 5 stars/ })).toHaveCount(0)
    await expect(page.locator('main a[href^="/reviews/"]')).toHaveCount(0)
    const body = page.locator("body")
    await expect(body).not.toContainText(/preview only, not saved to foodi|\(preview\)|sample reviews|rating only|name not shared|showing \d/i)
    // None of the sample reviewers, texts or order references.
    await expect(body).not.toContainText(/Aarav|Meera|Vikram|Kabir|Promo Account|dosa was still crisp|PRV-/)
  }
})

test("customers show no sample customers, contact details, controls or preview tools in production", async ({ page }) => {
  const paths = [
    "/customers",
    "/customers?q=preview&sort=name&page=2",
    "/customers?preview=slow",
    "/customers?preview=empty",
    "/customers?preview=error",
    "/customers?preview=forbidden",
    "/customers/prv-cus-01",
    "/customers/prv-cus-01?orders=2&preview=forbidden",
    "/customers/prv-cus-999?preview=empty",
  ]
  for (const path of paths) {
    await gotoAndSettle(page, path)
    // Whatever the URL asks for, production is not connected: never empty, failed, refused or "not found".
    await expect(page.getByText(/customers aren.t connected yet/i).first()).toBeVisible()
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0)
    // Nothing to search or sort while nothing is connected, and no reveal, copy, export or preview controls.
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(page.getByRole("searchbox")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /reveal|copy|export|show phone|show email|reset sample/i })).toHaveCount(0)
    await expect(page.locator('main a[href^="/customers/"], main a[href^="tel:"], main a[href^="mailto:"], main a[href^="/orders/"]')).toHaveCount(0)
    const body = page.locator("body")
    await expect(body).not.toContainText(/preview only, not saved to foodi|\(preview\)|preview customer|name not shared|no contact details|•|showing \d/i)
    await expect(body).not.toContainText(/PRV-|prv-cus/)
  }
})

test("wallet shows no sample amounts, settlements, payout details, controls or preview tools in production", async ({ page }) => {
  const paths = [
    "/wallet",
    "/wallet?preview=slow",
    "/wallet?preview=empty",
    "/wallet?preview=error",
    "/wallet?preview=forbidden",
    "/wallet/settlements",
    "/wallet/settlements?page=2&preview=empty",
    "/wallet/settlements/prv-set-01",
    "/wallet/settlements/prv-set-01?orders=2&preview=forbidden",
    "/wallet/settlements/prv-set-99?preview=empty",
  ]
  for (const path of paths) {
    await gotoAndSettle(page, path)
    // Whatever the URL asks for, production is not connected: never empty, failed, refused or "not found".
    await expect(page.getByText(/wallet isn.t connected yet/i).first()).toBeVisible()
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /withdraw|payout|export|download|statement|reset sample/i })).toHaveCount(0)
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(page.locator('main a[href^="/wallet/settlements/"], main a[href^="/orders/"]')).toHaveCount(0)
    const body = page.locator("body")
    // No amount of any kind, no sample label, no payout destination and no status.
    await expect(body).not.toContainText(/₹|INR|\d,\d{3}\.\d{2}|preview bank|•|preview only, not saved to foodi|\(preview\)|showing \d/i)
    await expect(body).not.toContainText(/not available|pending settlement|paid out|on hold|refund|commission|platform/i)
    await expect(body).not.toContainText(/PRV-|prv-set/)
  }
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
  expect(hrefs.sort()).toEqual([
    "/customers",
    "/dashboard",
    "/hours",
    "/menu",
    "/menu/categories",
    "/menu/meal-periods",
    "/orders",
    "/reviews",
    "/settings",
    "/settings/profile",
    "/wallet",
  ])
  await expect(visibleNav.getByText("Availability & hours")).toBeVisible()
  await expect(visibleNav).not.toContainText(/POS|QR/)
})
