import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Promotions (B6e) against preview data. The screens are read-only, so these
// tests change nothing and can run beside the other preview specs.
// Sample data: 14 coupons (prv-promo-01 to prv-promo-14), all codes PREVIEW-*.
//   status: 2 scheduled, 5 active, 2 paused, 2 expired, 2 cancelled, 1 reporting none
//   prv-promo-01 PREVIEW-SOON11 scheduled, percentage with a cap, restaurant-funded
//   prv-promo-02 PREVIEW-LIVE12 active, percentage, shared funding, Foodi-managed, stackable
//   prv-promo-03 PREVIEW-FLAT22 active, fixed amount, Foodi-funded
//   prv-promo-06 PREVIEW-NOSTATUS reports no status and nothing optional
//   prv-promo-08 PREVIEW-BARE has no dates and nothing optional
//   prv-promo-09 PREVIEW-ZERO has real zeros

const LOADED = "Showing 1–10 of 14 coupons"
const promotionLinks = (page: Page) => page.locator('main a[href^="/promotions/prv-promo-"]').filter({ visible: true })
const promotionHrefs = async (page: Page) =>
  promotionLinks(page).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!.split("?")[0]))])
// The previous page can stay mounted but hidden after a client navigation, so only visible values count.
const field = (page: Page, label: string) =>
  page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("+ dd").filter({ visible: true })

async function expectCleanPage(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
}

test.describe("coupon directory", () => {
  test("lists ten coupons a page with a total, a preview notice, and values exactly as supplied", async ({ page }) => {
    await gotoAndSettle(page, "/promotions")
    await expect(page.getByRole("heading", { level: 1, name: "Promotions" })).toBeVisible()
    await expect(page.getByRole("note").filter({ hasText: "Preview only, not saved to Foodi" })).toBeVisible()
    await expect(page.getByText(LOADED)).toBeVisible()
    await expect(page.getByText("Page 1 of 2")).toBeVisible()
    expect(await promotionHrefs(page)).toHaveLength(10)

    const main = page.locator("main")
    await expect(main.getByText("PREVIEW-LIVE12", { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(main.getByText("12.34% off").filter({ visible: true }).first()).toBeVisible()
    await expect(main.getByText(/₹22\.22 off/).filter({ visible: true }).first()).toBeVisible()
    // Every validity shows its year, so a past or far-off coupon can't look current.
    await expect(main.getByText(/\b20\d\d\b/).filter({ visible: true }).first()).toBeVisible()
    await expectCleanPage(page)
  })

  test("calculates nothing and offers no create, edit, delete, activate, pause, redeem or share control", async ({ page }) => {
    await gotoAndSettle(page, "/promotions")
    const main = page.locator("main")
    // Only the pager's disabled Previous button exists; no button creates, changes or shares anything.
    await expect(main.getByRole("button", { name: /create|new|edit|delete|activate|pause|resume|redeem|apply|copy|share|send|export/i })).toHaveCount(0)
    await expect(main.getByRole("textbox")).toHaveCount(0)
    await expect(main).not.toContainText(/new coupon|create|edit|delete|activate|pause coupon|resume|redeem|apply coupon|copy code|share|send|campaign|segment|export/i)
    await expect(main).not.toContainText(/you save|you.ll save|saves you|discounted price|after discount|total/i)
    await expect(main).not.toContainText(/GST|@|customer name|phone/i)
  })

  test("shows a coupon that reports no status or count as unavailable, and never works one out", async ({ page }) => {
    await gotoAndSettle(page, "/promotions")
    const row = page
      .locator('main tr:has(a[href^="/promotions/prv-promo-06"]), main li:has(a[href^="/promotions/prv-promo-06"])')
      .filter({ visible: true })
      .first()
    await expect(row.getByText("Not available").first()).toBeAttached()
    await expect(row).not.toContainText(/Active|Expired|Scheduled|Paused|Cancelled/)
  })

  test("filters by the reported status with strict URL parameters, and returns to page 1", async ({ page }) => {
    await gotoAndSettle(page, "/promotions?page=2")
    await expect(page.getByText("Showing 11–14 of 14 coupons")).toBeVisible({ timeout: 15_000 })
    const filters = page.getByRole("navigation", { name: "Filter coupons by status" })
    await filters.getByRole("link", { name: "Active" }).click()
    await expect(page).toHaveURL(/\/promotions\?status=active$/)
    await expect(page.getByText("Showing 1–5 of 5 coupons")).toBeVisible({ timeout: 15_000 })
    await expect(filters.getByRole("link", { name: "Active" })).toHaveAttribute("aria-current", "page")
    expect(await promotionHrefs(page)).toHaveLength(5)

    await gotoAndSettle(page, "/promotions?status=paused")
    await expect(page.getByText("Showing 1–2 of 2 coupons")).toBeVisible({ timeout: 15_000 })
    await gotoAndSettle(page, "/promotions?status=live")
    await expect(page.getByText(LOADED)).toBeVisible({ timeout: 15_000 })
    await gotoAndSettle(page, "/promotions?status=active&page=abc")
    await expect(page.getByText("Showing 1–5 of 5 coupons")).toBeVisible({ timeout: 15_000 })

    await gotoAndSettle(page, "/promotions?status=cancelled")
    await page.getByRole("link", { name: "Reset filter" }).click()
    await expect(page).toHaveURL(/\/promotions$/)
    await expect(page.getByText(LOADED)).toBeVisible({ timeout: 15_000 })
  })

  test("pages with strict URL parameters", async ({ page }) => {
    await gotoAndSettle(page, "/promotions")
    await page.getByRole("link", { name: "Next page" }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText("Showing 11–14 of 14 coupons")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()

    await gotoAndSettle(page, "/promotions?page=99")
    await expect(page.getByText("Showing 11–14 of 14 coupons")).toBeVisible({ timeout: 15_000 })
    await gotoAndSettle(page, "/promotions?restaurantId=other&kind=bogo&q=x")
    await expect(page.getByText(LOADED)).toBeVisible({ timeout: 15_000 })
  })

  test("shows the empty, error, forbidden and slow scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/promotions?preview=empty")
    await expect(page.getByText("No coupons yet")).toBeVisible()
    await expectCleanPage(page)

    await gotoAndSettle(page, "/promotions?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load coupons")
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Preview scenario")

    await gotoAndSettle(page, "/promotions?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)

    await page.goto("/promotions?preview=slow", { waitUntil: "commit" })
    await expect(page.getByRole("status", { name: "Loading coupons" })).toBeVisible()
    await expect(page.getByText(LOADED)).toBeVisible({ timeout: 15_000 })
  })

  test("shows a no-results state for an empty status, with a way back", async ({ page }) => {
    // The empty scenario has no coupons at all, so a filter on it is "no coupons", not "no results".
    await gotoAndSettle(page, "/promotions?status=paused&preview=empty")
    await expect(page.getByText("No coupons have this status")).toBeVisible()
    await page.getByRole("link", { name: "Reset filter" }).last().click()
    await expect(page).toHaveURL(/\/promotions$/)
  })
})

test.describe("coupon detail", () => {
  test("opens from the list, shows every supplied field, and goes back to the same view", async ({ page }) => {
    await gotoAndSettle(page, "/promotions?status=active")
    await expect(page.getByText("Showing 1–5 of 5 coupons")).toBeVisible({ timeout: 15_000 })
    await page.locator('main a[href^="/promotions/prv-promo-02"]').filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/promotions\/prv-promo-02\?status=active$/)
    await expect(page.getByRole("heading", { level: 1, name: "PREVIEW-LIVE12" })).toBeVisible()
    await expect(field(page, "Status")).toContainText("Active")
    await expect(field(page, "Name")).toHaveText("Preview percentage coupon")
    await expect(field(page, "Managed by")).toHaveText("Foodi")
    await expect(field(page, "Funded by")).toHaveText("Shared between your restaurant and Foodi")
    await expect(field(page, "Value")).toHaveText("12.34% off")
    await expect(field(page, "Maximum discount")).toContainText("Not available")
    await expect(field(page, "Minimum order")).toContainText("Not available")
    await expect(field(page, "Applies to")).toHaveText("Item subtotal, Packaging fee")
    await expect(field(page, "Order types")).toHaveText("Delivery, Takeaway, Dine-in")
    await expect(field(page, "Can be combined with other promotions")).toHaveText("Yes")
    await expect(field(page, "Limit per customer")).toHaveText("3")
    await expect(field(page, "Total usage limit")).toContainText("Not available")
    await expect(field(page, "Redemptions")).toHaveText("111")
    await expect(page.locator("main")).toContainText("Asia/Kolkata")
    await expect(page.locator("main")).toContainText(/counted by Foodi/i)
    await expect(page.locator("main")).toContainText(/doesn.t calculate savings, check who is eligible, or work out whether a coupon is valid right now/i)
    await expectCleanPage(page)

    await page.getByRole("link", { name: "All coupons" }).click()
    await expect(page).toHaveURL(/\/promotions\?status=active$/)
  })

  test("shows a fixed amount with a cap that does not apply, and a funding set by the source", async ({ page }) => {
    await gotoAndSettle(page, "/promotions/prv-promo-03")
    await expect(field(page, "Value")).toContainText(/₹22\.22 off/)
    await expect(field(page, "Maximum discount")).toHaveText("Not applicable to a fixed amount")
    await expect(field(page, "Funded by")).toHaveText("Foodi")
    await expect(field(page, "Minimum order")).toContainText(/₹222\.00/)
  })

  test("shows a coupon with nothing optional as unavailable and assumes nothing", async ({ page }) => {
    await gotoAndSettle(page, "/promotions/prv-promo-08")
    for (const label of ["Name", "Managed by", "Funded by", "Minimum order", "Applies to", "Starts", "Ends", "Order types", "Can be combined with other promotions", "Limit per customer", "Total usage limit", "Redemptions"]) {
      await expect(field(page, label)).toContainText("Not available")
    }
    await expect(page.locator("main")).not.toContainText(/all order types|every order|restaurant pays|foodi pays|never expires/i)
    await expectCleanPage(page)
  })

  test("keeps real zeros as zeros and a missing status as unavailable", async ({ page }) => {
    await gotoAndSettle(page, "/promotions/prv-promo-09")
    await expect(field(page, "Redemptions")).toHaveText("0")
    await expect(field(page, "Value")).toHaveText("0% off")
    await gotoAndSettle(page, "/promotions/prv-promo-06")
    await expect(field(page, "Status")).toContainText("Not available")
  })

  test("does not work out a status from the dates", async ({ page }) => {
    // prv-promo-05 ended in the past and reports "Expired"; prv-promo-01 starts in the future and reports "Scheduled".
    await gotoAndSettle(page, "/promotions/prv-promo-05")
    await expect(field(page, "Status")).toContainText("Expired")
    await gotoAndSettle(page, "/promotions/prv-promo-01")
    await expect(field(page, "Status")).toContainText("Scheduled")
  })

  test("shows a not-found page for an unknown coupon, never another one", async ({ page }) => {
    for (const path of ["/promotions/prv-promo-99", "/promotions/..%2Fprv-promo-01"]) {
      await gotoAndSettle(page, path)
      await expect(page.getByRole("heading", { name: "Coupon not found" })).toBeVisible()
      await expect(page.getByRole("link", { name: "Back to promotions" })).toBeVisible()
    }
  })

  test("shows the error, forbidden and empty scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/promotions/prv-promo-01?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load this coupon")
    await gotoAndSettle(page, "/promotions/prv-promo-01?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)
    await gotoAndSettle(page, "/promotions/prv-promo-01?preview=empty")
    await expect(page.getByRole("heading", { name: "Coupon not found" })).toBeVisible()
  })

  test("shows no customer, order or redemption-history data", async ({ page }) => {
    await gotoAndSettle(page, "/promotions/prv-promo-02")
    const main = page.locator("main")
    await expect(main).not.toContainText(/redeemed by|redemption history|customer name|order #|@|phone/i)
    // The only link is the way back to the list; nothing leads to customers or orders.
    await expect(main.locator('a[href^="/customers"], a[href^="/orders"], a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0)
    await expect(main.getByRole("button")).toHaveCount(0)
  })

  test("is reachable from the sidebar", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    // On small screens the sidebar is in a drawer.
    if (!(await page.getByRole("navigation", { name: "Restaurant admin" }).first().isVisible())) {
      await page.getByRole("button", { name: "Open navigation" }).click()
    }
    await page
      .getByRole("navigation", { name: "Restaurant admin" })
      .filter({ visible: true })
      .getByRole("link", { name: "Promotions" })
      .click()
    await expect(page).toHaveURL(/\/promotions$/)
    await expect(page.getByRole("heading", { level: 1, name: "Promotions" })).toBeVisible()
  })
})
