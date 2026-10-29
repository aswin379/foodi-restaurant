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
  const rows = recent.getByRole("list", { name: "Most recent orders" }).getByRole("listitem")
  expect(await rows.count()).toBeGreaterThan(0)
  expect(await rows.count()).toBeLessThanOrEqual(5)
  for (const href of await rows.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
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
  const first = section(page, "Recent orders").getByRole("list", { name: "Most recent orders" }).getByRole("link").first()
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
