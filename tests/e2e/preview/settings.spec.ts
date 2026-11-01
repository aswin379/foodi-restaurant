import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Order settings (B4a) against preview data. The restaurant profile now reads the real API; see restaurant-profile.spec.ts. They
// change the shared preview settings record, so they run one at a time and
// each starts from the reset sample settings. Only the settings record is
// written; hours and menu are only read, to show they're unchanged.
test.describe.configure({ mode: "serial" })

const PREVIEW_LABEL = "Preview only, not saved to Foodi"
async function resetSampleSettings(page: Page) {
  await gotoAndSettle(page, "/settings/orders")
  await page.getByRole("button", { name: "Reset sample settings" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
}

async function expectPreviewToast(page: Page, text: RegExp) {
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: text }).last()
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(PREVIEW_LABEL)
}

test.beforeEach(async ({ page }) => {
  await resetSampleSettings(page)
})

test.afterEach(async ({ page }) => {
  expectNoConsoleErrors(page)
})

test("the overview links to the profile, order settings and hours", async ({ page }) => {
  await gotoAndSettle(page, "/settings")
  const sections = page.getByRole("list", { name: "Settings sections" })
  await expect(sections.getByRole("link", { name: /Restaurant profile/ })).toHaveAttribute("href", "/settings/profile")
  await expect(sections.getByRole("link", { name: /Order settings/ })).toHaveAttribute("href", "/settings/orders")
  await expect(sections.getByRole("link", { name: /Availability & hours/ })).toHaveAttribute("href", "/hours")
  await expect(page.locator("main")).not.toContainText(/charges|tax|packaging|auto-accept/i)
})

test("settings pages at tablet width (820 px) have no overflow or serious accessibility issues", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  for (const path of ["/settings", "/settings/orders"]) {
    await gotoAndSettle(page, path)
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
  }
})

test("order settings: prep defaults per order type, one minimum order and the pickup code", async ({ page }) => {
  await gotoAndSettle(page, "/settings/orders")
  const saved = page.getByRole("region", { name: "Saved settings" })
  await expect(saved).toContainText("₹150.00")
  await expect(saved).toContainText("not live availability")

  await page.getByRole("textbox", { name: "Default prep time (minutes) for Takeaway" }).fill("3")
  await page.getByRole("textbox", { name: /Minimum order/ }).fill("99.999")
  await page.getByRole("button", { name: "Save order settings" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toContainText("Enter a takeaway prep time from 5 to 180 minutes.")
  await expect(summary).toContainText("the minimum order")

  // Zero isn't a minimum: blank is.
  await page.getByRole("textbox", { name: "Default prep time (minutes) for Takeaway" }).fill("12")
  await page.getByRole("textbox", { name: /Minimum order/ }).fill("0")
  await page.getByRole("button", { name: "Save order settings" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "before saving" })).toContainText(
    "Enter an amount above 0, or leave it blank for no minimum."
  )
  await page.getByRole("textbox", { name: /Minimum order/ }).fill("")
  await page.getByRole("switch", { name: "Require a pickup code" }).click()
  await expect(page.getByText("the Orders screen doesn't ask for it yet")).toBeVisible()
  await page.getByRole("button", { name: "Save order settings" }).click()
  await expectPreviewToast(page, /Order settings updated/)
  await expect(saved).toContainText("No minimum")
  await expect(saved).toContainText("Required")
  await expect(page.getByRole("textbox", { name: "Default prep time (minutes) for Takeaway" })).toHaveValue("12")
})

test("turning an order type off warns first and leaves hours and menu settings unchanged", async ({ page }) => {
  await gotoAndSettle(page, "/settings/orders")
  await page.getByRole("checkbox", { name: "Offer delivery" }).uncheck()
  await page.getByRole("button", { name: "Save order settings" }).click()
  let confirm = page.getByRole("alertdialog", { name: "Turn off delivery?" })
  await expect(confirm).toContainText("This saves delivery as off in your restaurant settings.")
  await expect(confirm).toContainText("Saving here doesn't by itself stop customers ordering at checkout.")
  await expect(confirm).toContainText("Hours, special dates and menu settings for delivery stay as they are.")
  await expect(confirm).toContainText("Orders already placed aren't changed.")
  await expect(confirm).not.toContainText(/once Foodi applies|has been applied|is enforced/)
  // Going back saves nothing.
  await confirm.getByRole("button", { name: "Go back" }).click()
  await expect(page.getByRole("region", { name: "Saved settings" })).toContainText("Delivery, Takeaway and Dine-in")

  await page.getByRole("button", { name: "Save order settings" }).click()
  confirm = page.getByRole("alertdialog", { name: "Turn off delivery?" })
  await confirm.getByRole("button", { name: "Turn off and save" }).click()
  await expectPreviewToast(page, /Order settings updated/)
  const saved = page.getByRole("region", { name: "Saved settings" })
  await expect(saved).toContainText(/Off\s*Delivery/)

  // Nothing else was rewritten (D6).
  await gotoAndSettle(page, "/hours")
  await expect(page.getByLabel("From, Delivery Monday window 1")).toHaveValue("11:00")
  await gotoAndSettle(page, "/menu/prv-item-11/edit")
  await expect(page.getByRole("group", { name: "Order types", exact: true }).getByRole("checkbox", { name: /Delivery/ })).toBeChecked()

  // At least one order type stays on.
  await gotoAndSettle(page, "/settings/orders")
  await page.getByRole("checkbox", { name: "Offer takeaway" }).uncheck()
  await page.getByRole("checkbox", { name: "Offer dine-in" }).uncheck()
  await page.getByRole("button", { name: "Save order settings" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "before saving" })).toContainText("Keep at least one order type on.")
})

test("order settings work from the keyboard", async ({ page }) => {
  await gotoAndSettle(page, "/settings/orders")
  await page.getByRole("checkbox", { name: "Offer dine-in" }).focus()
  await page.keyboard.press("Space")
  await expect(page.getByRole("checkbox", { name: "Offer dine-in" })).not.toBeChecked()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("textbox", { name: "Default prep time (minutes) for Dine-in" })).toBeFocused()
  await page.getByRole("button", { name: "Save order settings" }).focus()
  await page.keyboard.press("Enter")
  const confirm = page.getByRole("alertdialog", { name: "Turn off dine-in?" })
  await expect(confirm).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Save order settings" })).toBeFocused()
})

test("a permission refusal is shown clearly (D9)", async ({ page }) => {
  for (const path of ["/settings/orders?preview=forbidden"]) {
    await gotoAndSettle(page, path)
    await expect(page.getByRole("alert").filter({ hasText: "permission" })).toContainText(
      "You don't have permission to see or change restaurant settings"
    )
    await expect(page.getByRole("button", { name: /Save/ })).toHaveCount(0)
  }
})

// Settings visual redesign: accessibility, announcements, focus return and layout.

async function expectCleanLayout(page: Page) {
  await expectNoSeriousA11yViolations(page)
  await expectNoHorizontalOverflow(page)
}

test("the overview, profile and order settings are accessible and stay inside the viewport", async ({ page }) => {
  for (const [path, heading] of [
    ["/settings", "Settings"],
    ["/settings/orders", "Order settings"],
  ] as const) {
    await gotoAndSettle(page, path)
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible()
    await expectCleanLayout(page)
  }
})


test("order settings errors are announced in a summary, and the page stays accessible", async ({ page }) => {
  await gotoAndSettle(page, "/settings/orders")
  await page.getByLabel(/^Default prep time/).first().fill("")
  await page.getByRole("button", { name: "Save order settings" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toBeVisible()
  await expect(summary).toBeFocused()
  await expectCleanLayout(page)
})

test("the turn-off dialog is accessible, and Go back returns focus to Save", async ({ page }) => {
  await gotoAndSettle(page, "/settings/orders")
  await page.getByRole("checkbox", { name: "Offer takeaway" }).uncheck()
  const save = page.getByRole("button", { name: "Save order settings" })
  await save.click()
  const confirm = page.getByRole("alertdialog", { name: "Turn off takeaway?" })
  await expect(confirm).toBeVisible()
  await page.waitForTimeout(500)
  await expectNoSeriousA11yViolations(page)
  await confirm.getByRole("button", { name: "Go back" }).click()
  await expect(confirm).toHaveCount(0)
  await expect(save).toBeFocused()
})

test("every settings control stays inside the viewport", async ({ page }) => {
  const width = page.viewportSize()!.width
  for (const path of ["/settings/orders"]) {
    await gotoAndSettle(page, path)
    const boxes = await page
      .locator("main input:visible, main textarea:visible, main button:visible, main select:visible, main a:visible")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((box) => ({ left: box.left, right: box.right })))
    expect(boxes.length).toBeGreaterThan(8)
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(width)
    }
  }
})
