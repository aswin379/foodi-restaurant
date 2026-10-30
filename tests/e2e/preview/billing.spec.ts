import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Plan & billing (B6d) against preview data. The page is read-only, so these
// tests change nothing and can run beside the other preview specs.
// Variants: default (hybrid, active), ?preview=past_due (with a notice),
// ?preview=trial (subscription in trial), ?preview=minimal (nothing optional).

async function expectCleanPage(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
}

test.describe("plan & billing", () => {
  test("shows the plan, cycle, entitlements and fee terms exactly as supplied, with a preview notice", async ({ page }) => {
    await gotoAndSettle(page, "/billing")
    await expect(page.getByRole("heading", { level: 1, name: "Plan & billing" })).toBeVisible()
    await expect(page.getByRole("note").filter({ hasText: "Preview only, not saved to Foodi" })).toBeVisible()
    const main = page.locator("main")

    const field = (label: string) => page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("+ dd")
    await expect(field("Plan")).toHaveText("Preview plan")
    await expect(field("Model")).toHaveText("Commission and subscription")
    await expect(field("Status")).toContainText("Active")
    await expect(field("Renewal date")).not.toContainText("Not available")
    await expect(field("Trial ends")).toContainText("Not available")

    await expect(main.getByText("Preview entitlement A")).toBeVisible()
    await expect(main.getByText("Preview entitlement B")).toBeVisible()
    await expect(main.getByText("Preview entitlement C")).toBeVisible()

    await expect(main.getByText("Preview fee per order")).toBeVisible()
    await expect(main.getByText(/₹11\.11 per order/)).toBeVisible()
    await expect(main.getByText("Amount excludes Preview tax (11.11%)")).toBeVisible()
    await expect(main.getByText("12.34% of order value")).toBeVisible()
    await expect(main.getByText("Amount includes Preview tax")).toBeVisible()
    await expect(main.getByText(/₹1,111\.00 per billing period/)).toBeVisible()
    await expectCleanPage(page)
  })

  test("hard-codes no fee or tax, calculates nothing and offers no billing action", async ({ page }) => {
    await gotoAndSettle(page, "/billing")
    const main = page.locator("main")
    await expect(main).not.toContainText(/GST|₹10\.00|18%|18\.00%/)
    await expect(main).not.toContainText(/total|you pay|payable|plus tax/i)
    await expect(main).not.toContainText(/upgrade|downgrade|cancel|pay now|update payment|invoice(?!\.)|download|compare plans|billing history/i)
    await expect(main.getByRole("button")).toHaveCount(0)
    await expect(main.getByRole("textbox")).toHaveCount(0)
    await expect(main.getByRole("link")).toHaveCount(0)
    await expect(main).toContainText(/doesn.t calculate fees or tax/i)
    await expect(main).toContainText(/isn.t an invoice/i)
  })

  test("shows a past-due status and the server's notice, and makes no claim about access", async ({ page }) => {
    await gotoAndSettle(page, "/billing?preview=past_due")
    await expect(page.locator("dt", { hasText: /^Status$/ }).locator("+ dd")).toContainText("Past due")
    await expect(page.getByRole("note").filter({ hasText: "Message from Foodi" })).toContainText("Preview notice")
    await expect(page.locator("main")).not.toContainText(/restricted|suspended|blocked|locked|can.t (order|accept)/i)
    await expectCleanPage(page)
  })

  test("shows a trial with its end date and no renewal date", async ({ page }) => {
    await gotoAndSettle(page, "/billing?preview=trial")
    await expect(page.locator("dt", { hasText: /^Status$/ }).locator("+ dd")).toContainText("In trial")
    await expect(page.locator("dt", { hasText: /^Model$/ }).locator("+ dd")).toHaveText("Subscription")
    await expect(page.locator("dt", { hasText: /^Trial ends$/ }).locator("+ dd")).not.toContainText("Not available")
    await expect(page.locator("dt", { hasText: /^Renewal date$/ }).locator("+ dd")).toContainText("Not available")
    await expectCleanPage(page)
  })

  test("shows everything missing as unavailable and fills nothing in", async ({ page }) => {
    await gotoAndSettle(page, "/billing?preview=minimal")
    await expect(page.locator("dt", { hasText: /^Model$/ }).locator("+ dd")).toContainText("Not available")
    await expect(page.locator("dt", { hasText: /^Status$/ }).locator("+ dd")).toContainText("Not available")
    await expect(page.locator("dt", { hasText: /^Renewal date$/ }).locator("+ dd")).toContainText("Not available")
    await expect(page.getByText("No entitlements were provided for this plan.")).toBeVisible()
    await expect(page.getByText("No fee terms were provided for this plan.")).toBeVisible()
    await expect(page.locator("main")).not.toContainText(/Active|Past due|In trial|₹|%/)
    await expectCleanPage(page)
  })

  test("shows no-plan, error, forbidden and slow scenarios", async ({ page }) => {
    await gotoAndSettle(page, "/billing?preview=empty")
    await expect(page.getByText("No plan found")).toBeVisible()
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0)
    await expectCleanPage(page)

    await gotoAndSettle(page, "/billing?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("We couldn't load your plan")
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Preview scenario")

    await gotoAndSettle(page, "/billing?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/permission/i)

    await page.goto("/billing?preview=slow", { waitUntil: "commit" })
    await expect(page.getByRole("status", { name: "Loading plan" })).toBeVisible()
    await expect(page.getByText("Preview plan").first()).toBeVisible({ timeout: 15_000 })
  })

  test("ignores a restaurant identifier or any plan parameter in the URL", async ({ page }) => {
    await gotoAndSettle(page, "/billing?restaurantId=other&plan=premium&status=expired")
    await expect(page.locator("dt", { hasText: /^Plan$/ }).locator("+ dd")).toHaveText("Preview plan")
    await expect(page.locator("dt", { hasText: /^Status$/ }).locator("+ dd")).toContainText("Active")
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
      .getByRole("link", { name: "Plan & billing" })
      .click()
    await expect(page).toHaveURL(/\/billing$/)
    await expect(page.getByRole("heading", { level: 1, name: "Plan & billing" })).toBeVisible()
  })
})
