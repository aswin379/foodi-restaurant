import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Wallet and settlements (B6c) against preview data. The screens are read-only,
// so these tests change nothing and can run beside the other preview specs.
// Sample data: 14 settlements (prv-set-01 to prv-set-14), newest first.
//   prv-set-01 pending, 15 orders (two breakdown pages)
//   prv-set-02 processing, a pending refund line
//   prv-set-03 paid, a provider-confirmed refund line
//   prv-set-05 has one order with no order id (no link)
//   prv-set-06 has no status and no payout destination
//   prv-set-07 / prv-set-08 have an order with a pending / confirmed refund
//   prv-set-09 has no amounts, no order count and no lines
//   prv-set-14 has no orders

const LOADED = "Showing 1–10 of 14 settlements"
const settlementLinks = (page: Page) => page.locator('main a[href^="/wallet/settlements/prv-set-"]').filter({ visible: true })
const settlementHrefs = async (page: Page) =>
  settlementLinks(page).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!.split("?")[0]))])
const orderLinks = (page: Page) => page.locator('main a[href^="/orders/prv-"]').filter({ visible: true })
const orderHrefs = async (page: Page) =>
  orderLinks(page).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!))])

async function expectCleanPage(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
}

test.describe("wallet overview", () => {
  test("shows named amounts, a masked destination, recent settlements and a preview notice", async ({ page }) => {
    await gotoAndSettle(page, "/wallet")
    await expect(page.getByRole("heading", { level: 1, name: "Wallet & settlements" })).toBeVisible()
    await expect(page.getByRole("note").filter({ hasText: "Preview only, not saved to Foodi" })).toBeVisible()
    const main = page.locator("main")
    const figure = (label: string) => page.locator("dt", { hasText: label }).first().locator("..")
    await expect(figure("Pending settlement")).toContainText("3,333.00")
    await expect(figure("Paid out")).toContainText("99,999.00")
    // No on-hold figure is supplied, so it is unavailable, never zero.
    await expect(figure("On hold")).toContainText("Not available")
    await expect(figure("On hold")).not.toContainText("0.00")
    await expect(main.getByText("Preview bank •••• ••00")).toBeVisible()
    expect(await settlementHrefs(page)).toHaveLength(5)
    await expectCleanPage(page)
  })

  test("offers no withdrawal, payout, edit, export or statement controls and makes no payout claims", async ({ page }) => {
    await gotoAndSettle(page, "/wallet")
    const main = page.locator("main")
    await expect(main.getByRole("button")).toHaveCount(0)
    await expect(main.getByRole("textbox")).toHaveCount(0)
    await expect(main).not.toContainText(/withdraw|request payout|payout now|export|statement|download|edit bank|reveal/i)
    await expect(main).not.toContainText(/paid automatically|automatic payout|every week|weekly payout/i)
    await expect(main).toContainText(/doesn.t calculate or verify/i)
  })

  test("links to the full list", async ({ page }) => {
    await gotoAndSettle(page, "/wallet")
    await page.getByRole("link", { name: "View all settlements" }).click()
    await expect(page).toHaveURL(/\/wallet\/settlements$/)
    await expect(page.getByText(LOADED)).toBeVisible({ timeout: 15_000 })
  })

  test("shows the empty, error, forbidden and slow scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/wallet?preview=empty")
    await expect(page.getByText("No settlements yet")).toBeVisible()
    await expect(page.locator("main").getByText("Not available").first()).toBeAttached()
    await expectCleanPage(page)

    await gotoAndSettle(page, "/wallet?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load wallet")
    await expect(page.locator("body")).not.toContainText("Preview scenario")

    await gotoAndSettle(page, "/wallet?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)

    await page.goto("/wallet?preview=slow", { waitUntil: "commit" })
    await expect(page.getByRole("status", { name: "Loading wallet" })).toBeVisible()
    await expect(page.getByText("Pending settlement")).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("settlements list", () => {
  test("lists ten settlements a page with a total, supplied statuses and amounts", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements")
    await expect(page.getByRole("heading", { level: 1, name: "Settlements" })).toBeVisible()
    await expect(page.getByText(LOADED)).toBeVisible()
    await expect(page.getByText("Page 1 of 2")).toBeVisible()
    expect(await settlementHrefs(page)).toHaveLength(10)
    const main = page.locator("main")
    for (const status of ["Pending", "Processing", "Paid", "Failed", "On hold"]) {
      await expect(main.getByText(status, { exact: true }).filter({ visible: true }).first()).toBeVisible()
    }
    await expectCleanPage(page)
  })

  test("shows a missing status and missing amounts as unavailable", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements")
    const row = page
      .locator('main tr:has(a[href^="/wallet/settlements/prv-set-09"]), main li:has(a[href^="/wallet/settlements/prv-set-09"])')
      .filter({ visible: true })
      .first()
    await expect(row.getByText("Not available").first()).toBeAttached()
    await expect(row).not.toContainText("0.00")
  })

  test("pages with strict URL parameters", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements")
    await page.getByRole("link", { name: "Next page" }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText("Showing 11–14 of 14 settlements")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()

    await gotoAndSettle(page, "/wallet/settlements?page=abc")
    await expect(page.getByText(LOADED)).toBeVisible()
    await gotoAndSettle(page, "/wallet/settlements?page=99")
    await expect(page.getByText("Showing 11–14 of 14 settlements")).toBeVisible()
  })

  test("shows the empty, error and forbidden scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements?preview=empty")
    await expect(page.getByText("No settlements yet")).toBeVisible()
    await gotoAndSettle(page, "/wallet/settlements?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load settlements")
    await gotoAndSettle(page, "/wallet/settlements?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)
  })
})

test.describe("settlement detail", () => {
  test("opens from the list, shows the supplied period, status and lines, and goes back to the same page", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements?page=2")
    await expect(page.getByText("Showing 11–14 of 14 settlements")).toBeVisible({ timeout: 15_000 })
    const first = (await settlementHrefs(page))[0]
    await settlementLinks(page).first().click()
    await expect(page).toHaveURL(new RegExp(`${first}\\?page=2$`))
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Settlement")
    await expect(page.getByRole("heading", { name: "Commission, fees, tax and adjustments" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Orders in this settlement" })).toBeVisible()
    await expect(page.locator("main")).toContainText(/doesn.t verify them or any bank transfer/i)
    await expectCleanPage(page)

    await page.getByRole("link", { name: "All settlements" }).click()
    await expect(page).toHaveURL(/\/wallet\/settlements\?page=2$/)
  })

  test("shows server-supplied lines, a pending refund and a confirmed refund as distinct states", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements/prv-set-02")
    const main = page.locator("main")
    await expect(main.getByText("Platform commission")).toBeVisible()
    await expect(main.getByText(/refund pending, not final until the payment provider confirms it/i)).toBeVisible()
    await expect(main.getByText("Processing", { exact: true }).first()).toBeVisible()

    await gotoAndSettle(page, "/wallet/settlements/prv-set-03")
    await expect(main.getByText(/refund confirmed by the payment provider/i)).toBeVisible()
    await expect(main.getByText("Paid", { exact: true }).first()).toBeVisible()
    await expect(main).not.toContainText(/refund pending/i)
  })

  test("pages the order breakdown and opens an order from it", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements/prv-set-01")
    expect(await orderHrefs(page)).toHaveLength(10)
    const pagination = page.getByRole("navigation", { name: "Order breakdown pagination" })
    await expect(pagination).toContainText("Showing 1–10 of 15 orders")
    await pagination.getByRole("link", { name: "Next page" }).click()
    await expect(page).toHaveURL(/orders=2$/)
    await expect(pagination).toContainText("Showing 11–15 of 15 orders", { timeout: 15_000 })
    expect(await orderHrefs(page)).toHaveLength(5)

    const href = (await orderHrefs(page))[0]
    await orderLinks(page).first().click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByRole("heading", { level: 1, name: /^Order PRV-/ })).toBeVisible()
  })

  test("links an order only when an order id was supplied", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements/prv-set-05")
    // The sample order with no id shows its reference without a link.
    const references = await page.locator("main tbody tr, main ul > li").filter({ visible: true }).count()
    expect(references).toBeGreaterThan((await orderHrefs(page)).length)
  })

  test("marks a missing status, missing amounts, no lines, no destination and an empty breakdown", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements/prv-set-06")
    await expect(page.locator("main").getByText("Not available").first()).toBeAttached()
    // No status is supplied, so none is shown (the "Paid on" label is a field name, not a status).
    const status = page.locator("dt", { hasText: /^Status$/ }).locator("+ dd")
    await expect(status).toContainText("Not available")
    await expect(status).not.toContainText(/Paid|Pending|Processing|Failed|On hold/)

    await gotoAndSettle(page, "/wallet/settlements/prv-set-09")
    await expect(page.getByText(/no commission, fee, tax or adjustment lines were provided/i)).toBeVisible()

    await gotoAndSettle(page, "/wallet/settlements/prv-set-14")
    await expect(page.getByText("No orders listed")).toBeVisible()
    await expectCleanPage(page)
  })

  test("shows a not-found page for an unknown settlement, never another one", async ({ page }) => {
    for (const path of ["/wallet/settlements/prv-set-99", "/wallet/settlements/..%2Fprv-set-01"]) {
      await gotoAndSettle(page, path)
      await expect(page.getByRole("heading", { name: "Settlement not found" })).toBeVisible()
      await expect(page.getByRole("link", { name: "Back to settlements" })).toBeVisible()
    }
  })

  test("ignores a restaurant identifier in the URL", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements?restaurantId=other&restaurant=other")
    await expect(page.getByText(LOADED)).toBeVisible()
  })

  test("shows the error, forbidden and empty scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/wallet/settlements/prv-set-01?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load this settlement")
    await gotoAndSettle(page, "/wallet/settlements/prv-set-01?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)
    await gotoAndSettle(page, "/wallet/settlements/prv-set-01?preview=empty")
    await expect(page.getByRole("heading", { name: "Settlement not found" })).toBeVisible()
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
      .getByRole("link", { name: "Wallet & settlements" })
      .click()
    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole("heading", { level: 1, name: "Wallet & settlements" })).toBeVisible()
  })
})
