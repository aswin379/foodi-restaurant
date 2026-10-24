import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, gotoAndSettle } from "../helpers"

// Hours, special dates and pause against preview data. They change the shared
// preview store, so they run one at a time and each starts from the reset
// sample hours.
test.describe.configure({ mode: "serial" })

const PREVIEW_LABEL = "Preview only, not saved to Foodi"

/** A date in the preview restaurant's zone (Asia/Kolkata), as YYYY-MM-DD. */
const kolkataDate = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() + offsetDays * 86_400_000))

async function resetSampleHours(page: Page) {
  await gotoAndSettle(page, "/hours")
  await page.getByRole("button", { name: "Reset sample hours" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
}

async function expectPreviewToast(page: Page, text: RegExp) {
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: text }).last()
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(PREVIEW_LABEL)
}

const savesAs = (page: Page) => page.getByLabel("Saves as")

test.beforeEach(async ({ page }) => {
  await resetSampleHours(page)
})

test.afterEach(async ({ page }) => {
  expectNoConsoleErrors(page)
})

test("weekly hours: overnight windows, merging, and All day conflicts", async ({ page }) => {
  await expect(page.getByText("Times are in the restaurant's time zone, Asia/Kolkata.")).toBeVisible()
  // Friday delivery 18:00–02:00 belongs to Friday and runs into Saturday.
  await expect(page.getByText("Runs past midnight into Saturday, ending at 02:00.")).toBeVisible()

  // An overlapping window on Monday is merged when saved.
  await page.getByRole("button", { name: "Add window for Delivery Monday" }).click()
  await page.getByLabel("From, Delivery Monday window 3").fill("14:00")
  await page.getByLabel("To, Delivery Monday window 3").fill("16:00")
  await expect(savesAs(page)).toContainText("Mon 11:00–16:00, 18:00–23:30")

  // All day plus timed windows for the same day is refused (H2).
  await page.getByRole("checkbox", { name: "All day for Delivery Monday" }).check()
  await page.getByRole("button", { name: "Save hours" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toContainText("Delivery is already open all day on Monday.")
  await page.getByRole("checkbox", { name: "All day for Delivery Monday" }).uncheck()

  await page.getByRole("button", { name: "Save hours" }).click()
  await expectPreviewToast(page, /Opening hours updated/)
  await gotoAndSettle(page, "/hours")
  await expect(page.getByLabel("To, Delivery Monday window 1")).toHaveValue("16:00")
})

test("an error on another order type's tab is one click away", async ({ page }) => {
  await page.getByRole("tab", { name: "Dine-in" }).click()
  await page.getByLabel("From, Dine-in Tuesday window 1").fill("")
  await page.getByRole("tab", { name: "Delivery" }).click()
  await page.getByRole("button", { name: "Save hours" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await summary.getByRole("link", { name: "Dine-in: Enter a start time." }).click()
  await expect(page.getByRole("tab", { name: /Dine-in/ })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByLabel("From, Dine-in Tuesday window 1")).toBeFocused()
})

test("copy helpers: Same as delivery and Copy to all days", async ({ page }) => {
  await page.getByRole("tab", { name: "Takeaway" }).click()
  await page.getByRole("button", { name: "Same as delivery for Takeaway" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Use delivery hours" }).click()
  await expect(savesAs(page)).toContainText(/Takeaway\s*Mon–Thu 11:00–15:00, 18:00–23:30/)

  await page.getByRole("tab", { name: "Dine-in" }).click()
  await page.getByRole("button", { name: "Copy Sunday to… (Dine-in Sunday)" }).click()
  const popover = page.getByRole("dialog")
  await popover.getByRole("button", { name: "All other days" }).click()
  await popover.getByRole("button", { name: "Copy hours" }).click()
  await expect(savesAs(page)).toContainText(/Dine-in\s*Every day 12:00–15:00, 19:00–23:00/)

  await page.getByRole("button", { name: "Save hours" }).click()
  await expectPreviewToast(page, /Opening hours updated/)
})

test("special dates: duplicates refused, past read-only, H4 note neutral, edit and remove", async ({ page }) => {
  await gotoAndSettle(page, "/hours/special-dates")
  const past = page.getByRole("list", { name: "Past special dates" })
  await expect(past).toContainText("Staff training (preview)")
  await expect(past.getByText("Read-only")).toBeVisible()
  await expect(past.getByRole("button", { name: /Edit|Remove/ })).toHaveCount(0)

  // A second special date for the same date and order type is refused.
  await page.getByRole("button", { name: "Add special date" }).click()
  let dialog = page.getByRole("dialog", { name: "Add special date" })
  await dialog.getByLabel("Date").fill(kolkataDate(10))
  await dialog.getByRole("button", { name: "Add special date" }).click()
  await expect(dialog.getByText(/Takeaway and Dine-in already have a special date on/)).toBeVisible()
  await dialog.getByRole("checkbox", { name: "Takeaway" }).uncheck()
  await dialog.getByRole("checkbox", { name: "Dine-in" }).uncheck()
  await dialog.getByRole("radio", { name: "Special hours" }).check()
  await dialog.getByLabel("From, Special hours window 1").fill("17:00")
  await dialog.getByLabel("To, Special hours window 1").fill("01:00")
  await expect(dialog.getByText(/Runs past midnight into .*, ending at 01:00\./)).toBeVisible()
  await dialog.getByLabel("Note").fill("Late delivery test")
  await dialog.getByRole("button", { name: "Add special date" }).click()
  await expectPreviewToast(page, /Special date added for/)
  const upcoming = page.getByRole("list", { name: "Upcoming special dates" })
  await expect(upcoming.getByRole("listitem").filter({ hasText: "Late delivery test" })).toContainText("Open 17:00–01:00 (+1 day)")

  // The day after Friday's overnight delivery window: the overlap is stated, not resolved (H4).
  await upcoming.getByRole("listitem").filter({ hasText: "Local event (preview)" }).getByRole("button", { name: /^Edit/ }).click()
  dialog = page.getByRole("dialog", { name: /Edit special date/ })
  await expect(dialog.getByRole("note")).toContainText("Delivery: the Friday window 18:00–02:00 (+1 day) crosses into this date.")
  await expect(dialog.getByRole("note")).toContainText("being confirmed with Foodi")
  await dialog.getByRole("radio", { name: "Closed" }).check()
  await dialog.getByRole("button", { name: "Save changes" }).click()
  await expectPreviewToast(page, /updated/)
  await expect(upcoming.getByRole("listitem").filter({ hasText: "Local event (preview)" })).toContainText("Closed")

  await upcoming.getByRole("listitem").filter({ hasText: "Maintenance (preview)" }).getByRole("button", { name: /^Remove/ }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove special date" }).click()
  await expectPreviewToast(page, /removed/)
  await expect(upcoming).not.toContainText("Maintenance (preview)")
})

test("pause until midnight shows the server's resume time; resume from the dashboard", async ({ page }) => {
  await expect(page.getByText("Preview estimate: not Foodi's live availability.")).toBeVisible()
  await page.getByRole("button", { name: "Pause new orders" }).click()
  const dialog = page.getByRole("dialog", { name: "Pause new orders?" })
  await expect(dialog).toContainText("Orders already accepted or scheduled aren't changed.")
  await dialog.getByRole("radio", { name: "Rest of today (until midnight)" }).check()
  await expect(dialog).toContainText("Until midnight in Asia/Kolkata. Foodi works out the exact time")
  await dialog.getByLabel("Reason").fill("Gas supply issue")
  await dialog.getByRole("button", { name: "Pause new orders" }).click()

  await expectPreviewToast(page, /Restaurant paused until 00:00, .* \(Asia\/Kolkata\)/)
  const banner = page.getByRole("region", { name: /Restaurant paused until 00:00/ })
  await expect(banner).toContainText("Gas supply issue")
  const status = page.getByRole("region", { name: "New orders right now" })
  await expect(status.getByText("Paused", { exact: true })).toHaveCount(3)
  // P-2: no claim about scheduled orders without backend information.
  await expect(page.locator("main")).not.toContainText(/Scheduled orders:/)

  await gotoAndSettle(page, "/dashboard")
  await expect(page.getByRole("region", { name: /Restaurant paused until 00:00/ })).toBeVisible()
  await page.getByRole("button", { name: "Resume now" }).click()
  await expectPreviewToast(page, /Restaurant resumed/)
  await expect(page.getByRole("region", { name: /Restaurant paused/ })).toHaveCount(0)
})

test("the pause dialog works from the keyboard, and Escape changes nothing", async ({ page }) => {
  await page.getByRole("button", { name: "Pause new orders" }).focus()
  await page.keyboard.press("Enter")
  const dialog = page.getByRole("dialog", { name: "Pause new orders?" })
  const option = (name: string) => dialog.getByRole("radio", { name })
  await expect(option("30 minutes")).toBeChecked()
  await option("30 minutes").focus()

  // Arrow keys move focus and select (standard radio group); Space keeps the focused option selected.
  await page.keyboard.press("ArrowDown")
  await expect(option("1 hour")).toBeFocused()
  await expect(option("1 hour")).toBeChecked()
  await expect(option("30 minutes")).not.toBeChecked()
  // Each press is checked before the next, as a person's would be: Radix moves
  // focus in a timeout, so keys sent faster than that count from the same option.
  await page.keyboard.press("ArrowUp")
  await expect(option("30 minutes")).toBeChecked()
  await page.keyboard.press("ArrowUp")
  await expect(option("15 minutes")).toBeFocused()
  await expect(option("15 minutes")).toBeChecked()
  // Wraps from the first option to the last.
  await page.keyboard.press("ArrowUp")
  await expect(option("Until I resume")).toBeChecked()
  await page.keyboard.press("Space")
  await expect(option("Until I resume")).toBeChecked()

  // Tab leaves the group; Shift+Tab comes back to the checked option.
  await page.keyboard.press("Tab")
  await expect(dialog.getByLabel("Reason")).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(option("Until I resume")).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Pause new orders" })).toBeFocused()
  await expect(page.getByRole("region", { name: /Restaurant paused/ })).toHaveCount(0)
})
