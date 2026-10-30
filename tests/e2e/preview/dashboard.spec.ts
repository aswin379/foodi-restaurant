import { expect, type Page, test } from "@playwright/test"

import {
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  gotoAndSettle,
} from "../helpers"

// Dashboard (B5a) against preview data. Other specs change orders in parallel,
// so these checks only read, and assert structure and links rather than
// counts that can move (except under the fixed `empty` scenario).

const section = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) })
const DATE = String.raw`\d{4}-\d{2}-\d{2}`

test("each section shows labelled preview data with links to real destinations", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard")

  const live = section(page, "Live orders")
  await expect(live).toContainText("Preview: sample orders")
  const liveLinks = live.getByRole("link")
  await expect(liveLinks).toHaveCount(5)
  expect(await liveLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
    "/orders#board-new",
    "/orders#board-kitchen",
    "/orders#board-ready",
    "/orders#board-ready",
    "/orders#board-scheduled",
  ])
  for (const label of ["New", "In kitchen", "Ready", "Out for delivery", "Scheduled"]) {
    await expect(live.getByRole("link", { name: new RegExp(`^${label} \\d+ orders?, open the board$`) })).toBeVisible()
  }

  const today = section(page, "Today's orders")
  await expect(today).toContainText("Preview estimate from sample orders")
  await expect(today).toContainText("(Asia/Kolkata)")
  await expect(today.getByRole("link", { name: /placed today, open the order history/ })).toHaveAttribute(
    "href",
    new RegExp(`^/orders/history\\?from=${DATE}&to=${DATE}$`)
  )
  await expect(today.getByRole("link", { name: "Cancelled" })).toHaveAttribute(
    "href",
    new RegExp(`^/orders/history\\?from=${DATE}&to=${DATE}&status=cancelled$`)
  )

  const recent = section(page, "Recent orders")
  await expect(recent).toContainText("Preview: sample orders")
  // A table from lg up, cards below: whichever is shown, each order is one link to its detail page.
  const orderLinks = recent.locator('a[href^="/orders/prv-"]').filter({ visible: true })
  expect(await orderLinks.count()).toBeGreaterThan(0)
  expect(await orderLinks.count()).toBeLessThanOrEqual(5)
  for (const href of await orderLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
    expect(href).toMatch(/^\/orders\/prv-\d+$/)
  }

  const attention = section(page, "Needs attention")
  await expect(attention).toContainText("Preview: sample hours, orders and menu")
  await expect(attention).toContainText(/Checked at /)

  const quick = section(page, "Quick links")
  expect(await quick.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
    "/orders",
    "/menu",
    "/hours",
    "/settings/profile",
    "/settings/orders",
  ])
  await expect(page.locator("main")).not.toContainText(/\bSoon\b|coming soon/i)

  // The B3a opening status stays as it was.
  await expect(page.getByRole("region", { name: "New orders right now" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Manage hours and pause" })).toHaveAttribute("href", "/hours")

  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
})

test("every attention and recent-order link opens an existing page", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard")
  const hrefs = [
    ...(await section(page, "Needs attention").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))),
    ...(await section(page, "Recent orders").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))),
  ]
  for (const href of hrefs) {
    expect(href).toMatch(/^\/(hours|menu\?filter=sold_out|orders(#board-(new|kitchen))?|orders\/history|orders\/prv-\d+)$/)
  }
  // A hash link is checked by its target existing on the page, not by a second navigation.
  for (const href of new Set(hrefs)) {
    const [path, hash] = href!.split("#")
    const response = await page.goto(path)
    expect(response?.status(), href!).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached()
    if (hash) await expect(page.locator(`#${hash}`), href!).toBeAttached()
  }
})

test("a recent order opens its detail page", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard")
  const first = section(page, "Recent orders").locator('a[href^="/orders/prv-"]').filter({ visible: true }).first()
  const reference = (await first.textContent())!.trim()
  await first.click()
  await expect(page).toHaveURL(new RegExp(`/orders/${reference.toLowerCase()}$`))
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(`order ${reference}`, "i") })).toBeVisible()
})

test("links work from the keyboard", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard")
  const newOrders = section(page, "Live orders").getByRole("link").first()
  await newOrders.focus()
  await expect(newOrders).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/orders#board-new$/)
  await expect(page.getByRole("heading", { level: 1, name: /^orders$/i })).toBeVisible()
})

test("an empty orders source shows zeros and no recent orders, never sample figures", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard?previewOrders=empty")
  const live = section(page, "Live orders")
  for (const link of await live.getByRole("link").all()) await expect(link).toHaveAccessibleName(/ 0 orders, open the board$/)
  await expect(section(page, "Today's orders").getByRole("link", { name: /placed today/ })).toHaveText(/^0/)
  await expect(section(page, "Recent orders")).toContainText("No orders yet")
  await expect(section(page, "Recent orders")).not.toContainText("PRV-")
})

test("each section fails on its own, with a retry", async ({ page }) => {
  await gotoAndSettle(page, "/dashboard?previewOrders=error")
  for (const [name, what] of [
    ["Live orders", "live orders"],
    ["Today's orders", "today's orders"],
    ["Recent orders", "recent orders"],
  ]) {
    const failed = section(page, name)
    await expect(failed.getByRole("alert")).toHaveText(new RegExp(`We couldn.t load ${what}\\. Nothing has changed\\.`))
    await expect(failed.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/dashboard")
  }
  // Order checks are reported as not run, never as "all clear"; the menu check still runs.
  const attention = section(page, "Needs attention")
  await expect(attention).toContainText("Not checked: Waiting, late and unavailable-item orders (couldn't be loaded).")
  await expect(attention).not.toContainText("Nothing needs attention right now.")
  await expect(attention).not.toContainText("Sold-out menu items (")
  await expect(page.getByRole("region", { name: "New orders right now" })).toBeVisible()
  await expect(section(page, "Quick links").getByRole("link")).toHaveCount(5)
  expectNoConsoleErrors(page)

  await gotoAndSettle(page, "/dashboard?previewMenu=error&previewHours=error")
  await expect(section(page, "Needs attention")).toContainText("Not checked: Sold-out menu items (couldn't be loaded).")
  await expect(section(page, "Needs attention")).toContainText("Not checked: Pause status (couldn't be loaded).")
  await expect(section(page, "Live orders").getByRole("link")).toHaveCount(5)
  await expect(section(page, "Recent orders").getByRole("alert")).toHaveCount(0)
})

test("the dashboard at tablet width (820 px) has no overflow or serious accessibility issues", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await gotoAndSettle(page, "/dashboard")
  await expect(section(page, "Live orders")).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
})

// ---- Application shell (redesign Gate 4) ----

/** Overlays fade in; axe must see the settled colours, not a half-transparent frame. */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    )
  )
}

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

test.describe("application shell", () => {
  test("the Notifications popover and the Account menu have no accessibility findings, and give focus back", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")

    const bell = page.getByRole("button", { name: "Notifications" })
    await bell.click()
    await expect(page.getByRole("dialog", { name: "Notifications" })).toBeVisible()
    await expect(page.getByText("No notifications")).toBeVisible()
    await settleAnimations(page)
    // Nothing is exempted: the popover is not a menu, and it doesn't hide the page from assistive technology.
    await expectNoSeriousA11yViolations(page)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "Notifications" })).toHaveCount(0)
    await expect(bell).toBeFocused()

    const account = page.getByRole("button", { name: "Account menu" })
    await account.click()
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible()
    await settleAnimations(page)
    await expectNoSeriousA11yViolations(page)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(account).toBeFocused()
    expectNoConsoleErrors(page)
  })

  test("an open menu never hides the skip link inside an aria-hidden region", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    await page.getByRole("button", { name: "Account menu" }).click()
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible()
    const hiddenAncestors = page.locator('a[href="#main-content"]').locator('xpath=ancestor-or-self::*[@aria-hidden="true"]')
    await expect(hiddenAncestors).toHaveCount(0)
  })

  test("the menus work from the keyboard", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    const account = page.getByRole("button", { name: "Account menu" })
    await account.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menu")).toBeVisible()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(account).toBeFocused()
  })

  test("the skip link is the first stop and moves focus to the page content", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press("Enter")
    await expect(page.locator("#main-content")).toBeFocused()
  })

  test("the sidebar shows the groups, the active page, the restaurant card and Log out", async ({ page }) => {
    test.skip(!isDesktop(page), "the sidebar is a drawer below 1024px; see the next test")
    await gotoAndSettle(page, "/dashboard")
    const sidebar = page.getByRole("complementary", { name: "Sidebar" })
    await expect(sidebar).toBeVisible()
    for (const group of ["Overview", "Operations", "Restaurant", "Business", "Help"]) {
      await expect(sidebar.getByRole("heading", { level: 2, name: group })).toBeAttached()
    }
    await expect(sidebar.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page")
    await expect(sidebar.getByRole("link", { name: "Orders" })).not.toHaveAttribute("aria-current", "page")
    // The restaurant card says plainly that nothing is connected: no invented name, ID or open status.
    await expect(sidebar).toContainText("Your restaurant")
    await expect(sidebar).toContainText("Not connected")
    await expect(sidebar.getByRole("button", { name: "Log out" })).toBeVisible()
    expect(await sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBe(288)
    // "Soon" items stay disabled, not links.
    await expect(sidebar.getByRole("link", { name: /^Delivery/ })).toHaveCount(0)
  })

  test("the sidebar collapses to a rail and back, keeping every name for screen readers", async ({ page }) => {
    test.skip(!isDesktop(page), "the sidebar is a drawer below 1024px")
    await gotoAndSettle(page, "/dashboard")
    const sidebar = page.getByRole("complementary", { name: "Sidebar" })
    await page.getByRole("button", { name: "Collapse sidebar" }).click()
    await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBe(108)
    await expect(sidebar.getByRole("link", { name: "Orders" })).toBeVisible()
    await expect(sidebar.getByRole("button", { name: "Log out" })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await page.getByRole("button", { name: "Expand sidebar" }).click()
    await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBe(288)
  })

  test("below 1024px the navigation is a drawer with the same links, and choosing one closes it", async ({ page }) => {
    test.skip(isDesktop(page), "the drawer only exists below 1024px")
    await gotoAndSettle(page, "/dashboard")
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeHidden()
    await page.getByRole("button", { name: "Open navigation" }).click()
    const drawer = page.getByRole("dialog", { name: "Navigation" })
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText("Not connected")
    await expect(drawer.getByRole("button", { name: "Log out" })).toBeVisible()
    await settleAnimations(page)
    await expectNoSeriousA11yViolations(page)
    await drawer.getByRole("link", { name: "Orders" }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(drawer).toHaveCount(0)
  })

  test("the dashboard recomposes at every width without overflow or accessibility findings", async ({ page }) => {
    for (const width of [1440, 1024, 820, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await gotoAndSettle(page, "/dashboard")
      await expect(section(page, "Live orders")).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectNoSeriousA11yViolations(page)
    }
    expectNoConsoleErrors(page)
  })

  test("the dashboard shows only what the data contract supplies: no invented metrics, charts or search", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    const main = page.locator("main")
    await expect(main).not.toContainText(/sales|revenue|₹\s?24|rating|new customers|vs\. yesterday|top selling|analytics/i)
    await expect(page.getByRole("searchbox")).toHaveCount(0)
    await expect(page.getByRole("search")).toHaveCount(0)
    await expect(page.locator("main canvas, main svg[role='img'][aria-label*='chart' i]")).toHaveCount(0)
  })
})
