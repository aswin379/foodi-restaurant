import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Customers (B6b) against preview data. The screens are read-only, so these
// tests change nothing and can run in parallel with the other preview specs.
// Sample data: 25 customers (prv-cus-01 to prv-cus-25). prv-cus-01 has a
// two-page order history, prv-cus-03 has no order count or spend, prv-cus-05
// has no name, prv-cus-07 has no order dates and prv-cus-25 has no orders.

/** The customer links on the page, whichever of the table or the cards is shown at this width. */
const customerLinks = (page: Page) => page.locator('main a[href^="/customers/prv-cus-"]').filter({ visible: true })
const customerHrefs = async (page: Page) =>
  customerLinks(page).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!.split("?")[0]))])
const orderLinks = (page: Page) => page.locator('main a[href^="/orders/prv-"]').filter({ visible: true })
const orderHrefs = async (page: Page) =>
  orderLinks(page).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!))])

async function expectCleanPage(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
}

test.describe("customer directory", () => {
  test("lists ten customers a page with a total, a preview notice and masked contact only", async ({ page }) => {
    await gotoAndSettle(page, "/customers")
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible()
    await expect(page.getByRole("note").filter({ hasText: "Preview only, not saved to Foodi" })).toBeVisible()
    expect(await customerHrefs(page)).toHaveLength(10)
    await expect(page.getByText("Showing 1–10 of 25 customers")).toBeVisible()
    await expect(page.getByText("Page 1 of 3")).toBeVisible()

    const main = page.locator("main")
    await expect(main).not.toContainText(/@[a-z0-9-]+\.(com|org|net|in)\b/i)
    await expect(main.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0)
    await expect(main.getByRole("button", { name: /reveal|show|copy|export/i })).toHaveCount(0)
    await expect(main.getByText("•••••• ••").filter({ visible: true }).first()).toBeVisible()
    await expectCleanPage(page)
  })

  test("shows unavailable metrics as a marker, never zero", async ({ page }) => {
    await gotoAndSettle(page, "/customers?page=1")
    // prv-cus-03 has no order count or spend: its card or row says "Not available".
    const row = page
      .locator('main a[href^="/customers/prv-cus-03"], main tr:has(a[href^="/customers/prv-cus-03"])')
      .filter({ visible: true })
      .first()
    await expect(row.getByText("Not available").first()).toBeVisible()
  })

  test("searches names case-insensitively and keeps the search in the URL", async ({ page }) => {
    await gotoAndSettle(page, "/customers")
    await page.getByLabel("Search customers by name").fill("CUSTOMER 1")
    await page.getByRole("button", { name: "Search" }).click()
    await expect(page).toHaveURL(/\/customers\?q=CUSTOMER\+1$/)
    await expect(page.getByText("Showing 1–10 of 10 customers")).toBeVisible()
    for (const href of await customerHrefs(page)) expect(href).toMatch(/prv-cus-1\d$/)
    await expectCleanPage(page)
  })

  test("shows a no-results state with a way back", async ({ page }) => {
    await gotoAndSettle(page, "/customers?q=zzz")
    await expect(page.getByText("No customers match this search")).toBeVisible()
    await page.locator("main").getByRole("link", { name: "Clear search" }).last().click()
    await expect(page).toHaveURL(/\/customers$/)
    await expect(page.getByText("Showing 1–10 of 25 customers")).toBeVisible({ timeout: 15_000 })
    expect(await customerHrefs(page)).toHaveLength(10)
  })

  test("sorts by name from the URL and from the sort links", async ({ page }) => {
    await gotoAndSettle(page, "/customers")
    await page.getByRole("navigation", { name: "Sort customers" }).getByRole("link", { name: "Name A–Z" }).click()
    await expect(page).toHaveURL(/sort=name/)
    await expect(page.getByText("Showing 1–10 of 25 customers")).toBeVisible()
    expect((await customerHrefs(page))[0]).toBe("/customers/prv-cus-01")
    await expect(page.getByRole("navigation", { name: "Sort customers" }).getByRole("link", { name: "Name A–Z" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  test("pages through the directory with strict URL parameters", async ({ page }) => {
    await gotoAndSettle(page, "/customers")
    await page.getByRole("link", { name: "Next page" }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText("Showing 11–20 of 25 customers")).toBeVisible()
    await page.getByRole("link", { name: "Next page" }).click()
    await expect(page.getByText("Showing 21–25 of 25 customers")).toBeVisible()
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()

    await gotoAndSettle(page, "/customers?page=abc&sort=spend")
    await expect(page.getByText("Showing 1–10 of 25 customers")).toBeVisible()
    await gotoAndSettle(page, "/customers?page=99")
    await expect(page.getByText("Showing 21–25 of 25 customers")).toBeVisible()
  })

  test("shows the empty, error, forbidden and slow scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/customers?preview=empty")
    await expect(page.getByText("No customers yet")).toBeVisible()
    await expectCleanPage(page)

    await gotoAndSettle(page, "/customers?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load customers")
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Preview scenario")

    await gotoAndSettle(page, "/customers?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)

    await page.goto("/customers?preview=slow", { waitUntil: "commit" })
    await expect(page.getByRole("status", { name: "Loading customers" })).toBeVisible()
    await expect(page.getByText("Showing 1–10 of 25 customers")).toBeVisible({ timeout: 10_000 })
  })
})

test.describe("customer profile", () => {
  test("opens from the list, shows masked contact and metrics, and goes back to the same view", async ({ page }) => {
    await gotoAndSettle(page, "/customers?q=customer&sort=name&page=2")
    const first = (await customerHrefs(page))[0]
    await customerLinks(page).first().click()
    await expect(page).toHaveURL(new RegExp(`${first}\\?q=customer&sort=name&page=2$`))
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Preview customer")
    await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible()
    await expect(page.getByText(/hidden to protect/i)).toBeVisible()
    await expect(page.locator('main a[href^="tel:"], main a[href^="mailto:"]')).toHaveCount(0)
    await expect(page.locator("main").getByRole("button", { name: /reveal|show|copy|export|call|email/i })).toHaveCount(0)
    await expectCleanPage(page)

    await page.getByRole("link", { name: "All customers" }).click()
    await expect(page).toHaveURL(/\/customers\?q=customer&sort=name&page=2$/)
    // The unnamed customer (prv-cus-05) never matches a name search, so 24 match.
    await expect(page.getByText("Showing 11–20 of 24 customers")).toBeVisible({ timeout: 15_000 })
  })

  test("pages the order history and opens an order from it", async ({ page }) => {
    await gotoAndSettle(page, "/customers/prv-cus-01")
    expect(await orderHrefs(page)).toHaveLength(10)
    const pagination = page.getByRole("navigation", { name: "Order history pagination" })
    await expect(pagination).toContainText("Showing 1–10 of 14 orders")
    await pagination.getByRole("link", { name: "Next page" }).click()
    await expect(page).toHaveURL(/orders=2$/)
    await expect(pagination).toContainText("Showing 11–14 of 14 orders")
    expect(await orderHrefs(page)).toHaveLength(4)

    const href = (await orderHrefs(page))[0]
    await orderLinks(page).first().click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByRole("heading", { level: 1, name: /^Order PRV-/ })).toBeVisible()
  })

  test("marks missing values, a missing name and an empty history", async ({ page }) => {
    await gotoAndSettle(page, "/customers/prv-cus-03")
    await expect(page.getByText("Not available").first()).toBeAttached()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Preview customer 03")

    await gotoAndSettle(page, "/customers/prv-cus-05")
    await expect(page.getByRole("heading", { level: 1, name: "Name not shared" })).toBeVisible()

    await gotoAndSettle(page, "/customers/prv-cus-25")
    await expect(page.getByText("No orders yet")).toBeVisible()
    await expectCleanPage(page)
  })

  test("shows a not-found page for an unknown or malformed customer, never another customer", async ({ page }) => {
    for (const path of ["/customers/prv-cus-999", "/customers/..%2Fprv-cus-01"]) {
      await gotoAndSettle(page, path)
      await expect(page.getByRole("heading", { name: "Customer not found" })).toBeVisible()
      await expect(page.getByRole("link", { name: "Back to customers" })).toBeVisible()
    }
  })

  test("ignores a restaurant identifier in the URL", async ({ page }) => {
    await gotoAndSettle(page, "/customers?restaurantId=other&restaurant=other")
    await expect(page.getByText("Showing 1–10 of 25 customers")).toBeVisible()
  })

  test("shows the error and forbidden scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/customers/prv-cus-01?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load this customer")
    await gotoAndSettle(page, "/customers/prv-cus-01?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)
    await gotoAndSettle(page, "/customers/prv-cus-01?preview=empty")
    await expect(page.getByRole("heading", { name: "Customer not found" })).toBeVisible()
  })

  test("is reachable from the sidebar", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    // On small screens the sidebar is in a drawer.
    if (!(await page.getByRole("navigation", { name: "Restaurant admin" }).first().isVisible())) {
      await page.getByRole("button", { name: "Open navigation" }).click()
    }
    await page.getByRole("navigation", { name: "Restaurant admin" }).filter({ visible: true }).getByRole("link", { name: "Customers" }).click()
    await expect(page).toHaveURL(/\/customers$/)
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible()
  })
})
