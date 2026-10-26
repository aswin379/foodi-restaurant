import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Menu workflows against preview data. They change the shared preview store,
// so they run one at a time and each starts from the reset sample menu.
test.describe.configure({ mode: "serial" })

const PREVIEW_LABEL = "Preview only, not saved to Foodi"
// A 1×1 transparent PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

async function resetSampleMenu(page: Page) {
  await gotoAndSettle(page, "/menu")
  await page.getByRole("button", { name: "Reset sample menu" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
}

async function expectPreviewToast(page: Page, text: RegExp) {
  // The toast itself; Radix's hidden "status" announcement only lasts about a second.
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: text }).last()
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(PREVIEW_LABEL)
}

/** The visible row (desktop table) or card (mobile list) for an item. */
const itemRow = (page: Page, name: string) =>
  page.locator("tr, li").filter({ has: page.getByText(name, { exact: true }) }).filter({ visible: true }).first()

test.beforeEach(async ({ page }) => {
  await resetSampleMenu(page)
})

test.afterEach(async ({ page }) => {
  expectNoConsoleErrors(page)
})

test("status filters separate available, sold out and archived items", async ({ page }) => {
  await gotoAndSettle(page, "/menu?filter=sold_out")
  await expect(page.getByText("2 items")).toBeVisible()
  await expect(itemRow(page, "Chicken 65")).toContainText("Sold out until next opening")

  await gotoAndSettle(page, "/menu?filter=archived")
  await expect(itemRow(page, "Christmas plum cake")).toContainText("Archived")

  await gotoAndSettle(page, "/menu?category=prv-cat-breakfast")
  await expect(itemRow(page, "Masala dosa")).toContainText("Category off")
})

test("marking an item sold out asks how long, and one tap makes it available again", async ({ page }) => {
  await gotoAndSettle(page, "/menu?q=paneer+tikka")
  await itemRow(page, "Paneer tikka").getByRole("switch", { name: "Available: Paneer tikka" }).click()
  const dialog = page.getByRole("alertdialog", { name: "Mark Paneer tikka sold out?" })
  await expect(dialog).toContainText("Hidden from customers while unavailable.")
  await dialog.getByRole("radio", { name: "For 2 hours" }).check()
  await dialog.getByRole("textbox").fill("Ran out of paneer")
  await dialog.getByRole("button", { name: "Mark sold out" }).click()

  await expectPreviewToast(page, /Paneer tikka marked sold out/)
  await expect(itemRow(page, "Paneer tikka")).toContainText(/Sold out until \d/)

  await itemRow(page, "Paneer tikka").getByRole("switch", { name: "Available: Paneer tikka" }).click()
  await expectPreviewToast(page, /Paneer tikka is available again/)
  await expect(itemRow(page, "Paneer tikka")).toContainText("Available")
})

test("the sold-out choices work from the keyboard", async ({ page }) => {
  await gotoAndSettle(page, "/menu?q=dal+makhani")
  await itemRow(page, "Dal makhani").getByRole("switch", { name: "Available: Dal makhani" }).click()
  const dialog = page.getByRole("alertdialog", { name: "Mark Dal makhani sold out?" })
  await dialog.getByRole("radio", { name: "Until next opening" }).focus()
  // Arrow keys move focus and select.
  await page.keyboard.press("ArrowDown")
  await expect(dialog.getByRole("radio", { name: "Until end of day" })).toBeChecked()
  await page.keyboard.press("ArrowDown")
  await expect(dialog.getByRole("radio", { name: "For 1 hour" })).toBeFocused()
  await expect(dialog.getByRole("radio", { name: "For 1 hour" })).toBeChecked()
  await expect(dialog.getByRole("radio", { name: "Until next opening" })).not.toBeChecked()
  await dialog.getByRole("button", { name: "Mark sold out" }).click()
  await expectPreviewToast(page, /Dal makhani marked sold out/)
  await expect(itemRow(page, "Dal makhani")).toContainText(/Sold out until \d/)
})

test("a new item needs a name, a category and a price", async ({ page }) => {
  await gotoAndSettle(page, "/menu/new")
  await page.getByRole("button", { name: "Add item" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toContainText("Enter the item name.")
  await expect(summary).toContainText("Choose a category. Every item needs one.")
  await expect(summary).toContainText("Enter the price.")

  await summary.getByRole("link", { name: /Choose a category/ }).click()
  await expect(page.getByRole("combobox", { name: /Category/ })).toBeFocused()

  await page.getByRole("textbox", { name: /Item name/ }).fill("Aloo paratha")
  await page.getByRole("combobox", { name: /Category/ }).selectOption({ label: "Breads" })
  await page.getByRole("textbox", { name: /Price/ }).fill("90")
  await page.getByRole("radio", { name: "Veg", exact: true }).check()
  await page.getByRole("checkbox", { name: "Gluten" }).check()
  await page.getByRole("button", { name: "Add item" }).click()

  await expectPreviewToast(page, /Aloo paratha added to the menu/)
  await expect(page).toHaveURL(/\/menu$/)
  await gotoAndSettle(page, "/menu?q=aloo")
  await expect(itemRow(page, "Aloo paratha")).toContainText("Breads")
})

test("sizes replace the price, and option groups enforce their limits", async ({ page }) => {
  await gotoAndSettle(page, "/menu/new")
  await page.getByRole("textbox", { name: /Item name/ }).fill("Thali")
  await page.getByRole("combobox", { name: /Category/ }).selectOption({ label: "Mains" })

  await page.getByRole("button", { name: "Add size" }).click()
  await page.getByRole("button", { name: "Add size" }).click()
  await expect(page.getByText("Set by sizes below.")).toBeVisible()
  const sizes = page.getByRole("list", { name: "Sizes" }).getByRole("listitem")
  await sizes.nth(0).getByRole("textbox", { name: "Size name" }).fill("Mini")
  await sizes.nth(0).getByRole("textbox", { name: "Price (₹)" }).fill("150")
  await sizes.nth(1).getByRole("textbox", { name: "Size name" }).fill("Full")
  await sizes.nth(1).getByRole("textbox", { name: "Price (₹)" }).fill("250")

  await page.getByRole("button", { name: "Add option group" }).click()
  await page.getByRole("textbox", { name: "Group name" }).fill("Extras")
  await page.getByRole("radio", { name: "Several options" }).check()
  await page.getByRole("textbox", { name: "At most" }).fill("3")
  await page.getByRole("textbox", { name: "Option name" }).fill("Papad")
  await page.getByRole("button", { name: "Add item" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "before saving" })).toContainText("Can't be more than the 1 options.")

  await page.getByRole("textbox", { name: "At most" }).fill("1")
  await page.getByRole("button", { name: "Add item" }).click()
  await expectPreviewToast(page, /Thali added to the menu/)

  await gotoAndSettle(page, "/menu?q=thali")
  await expect(itemRow(page, "Thali")).toContainText("From ₹150.00")
  await expect(itemRow(page, "Thali")).toContainText("2 sizes · 1 option group")
})

test("editing keeps the item's sizes and options", async ({ page }) => {
  await gotoAndSettle(page, "/menu/prv-item-13/edit")
  await expect(page.getByRole("heading", { level: 1, name: "Edit Veg biryani" })).toBeVisible()
  const sizes = page.getByRole("list", { name: "Sizes" }).getByRole("listitem")
  await sizes.nth(0).getByRole("textbox", { name: "Price (₹)" }).fill("130")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expectPreviewToast(page, /Veg biryani updated/)

  await gotoAndSettle(page, "/menu?q=veg+biryani")
  await expect(itemRow(page, "Veg biryani")).toContainText("From ₹130.00")
  await gotoAndSettle(page, "/menu/prv-item-13/edit")
  await expect(page.getByRole("textbox", { name: "Group name" })).toHaveValue("Spice level")
})

test("images are checked for type and size, and previewed as a square", async ({ page }) => {
  await gotoAndSettle(page, "/menu/prv-item-01/edit")
  const input = page.locator("#item-image")

  await input.setInputFiles({ name: "menu.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") })
  await expect(page.getByText("Choose a JPG, PNG or WebP image.")).toBeVisible()

  await input.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
  await expect(page.getByText("Choose an image of 2 MB or less.")).toBeVisible()

  await input.setInputFiles({ name: "dish.png", mimeType: "image/png", buffer: TINY_PNG })
  await expect(page.getByRole("img", { name: "Item image" })).toBeVisible()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expectPreviewToast(page, /Paneer tikka updated/)
})

test("archive and restore an item; delete one that was never ordered", async ({ page }) => {
  await gotoAndSettle(page, "/menu?q=dal")
  await itemRow(page, "Dal makhani").getByRole("button", { name: "More actions for Dal makhani" }).click()
  await expect(page.getByRole("menuitem", { name: "Delete item" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Archive item" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive item" }).click()
  await expectPreviewToast(page, /Dal makhani archived/)

  await gotoAndSettle(page, "/menu?filter=archived&q=dal")
  await itemRow(page, "Dal makhani").getByRole("button", { name: "More actions for Dal makhani" }).click()
  await page.getByRole("menuitem", { name: "Restore item" }).click()
  await expectPreviewToast(page, /Dal makhani restored/)

  await gotoAndSettle(page, "/menu?q=hara")
  await itemRow(page, "Hara bhara kebab").getByRole("button", { name: "More actions for Hara bhara kebab" }).click()
  await page.getByRole("menuitem", { name: "Delete item" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete item" }).click()
  await expectPreviewToast(page, /Hara bhara kebab deleted/)
  await gotoAndSettle(page, "/menu?q=hara")
  await expect(page.getByText("No items match these filters")).toBeVisible()
})

test("categories can be reordered with the keyboard", async ({ page }) => {
  await gotoAndSettle(page, "/menu/categories")
  const order = page.getByRole("region", { name: /Menu order/ }).getByRole("listitem")
  await expect(order.nth(0)).toContainText("Starters")
  await page.getByRole("button", { name: "Move Mains up" }).focus()
  await page.keyboard.press("Enter")
  await expectPreviewToast(page, /Mains moved up/)
  await expect(order.nth(0)).toContainText("Mains")
  await expect(page.getByRole("button", { name: "Move Mains up" })).toHaveAttribute("aria-disabled", "true")
})

test("a category with items can't be archived; an empty one can, then be restored", async ({ page }) => {
  await gotoAndSettle(page, "/menu/categories")
  await page.getByRole("button", { name: "Archive Drinks" }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Archive category" }).click()
  await expect(dialog.getByRole("alert")).toContainText("Move or archive its 4 items first.")
  await dialog.getByRole("button", { name: "Go back" }).click()

  await page.getByRole("button", { name: "Archive Seasonal specials" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive category" }).click()
  await expectPreviewToast(page, /Seasonal specials archived/)
  const archived = page.getByRole("region", { name: /Archived/ })
  await expect(archived).toContainText("Seasonal specials")
  await archived.getByRole("button", { name: "Restore Seasonal specials" }).click()
  await expectPreviewToast(page, /Seasonal specials restored/)
})

test("add a category, switch it off, and delete it", async ({ page }) => {
  await gotoAndSettle(page, "/menu/categories")
  await page.getByRole("button", { name: "Add category" }).click()
  let dialog = page.getByRole("dialog", { name: "Add category" })
  await dialog.getByRole("textbox", { name: /Category name/ }).fill("Starters")
  await dialog.getByRole("button", { name: "Add category" }).click()
  await expect(dialog.getByText("Another category already has this name.")).toBeVisible()
  await dialog.getByRole("textbox", { name: /Category name/ }).fill("Chaat")
  await dialog.getByRole("button", { name: "Add category" }).click()
  await expectPreviewToast(page, /Chaat added/)

  await page.getByRole("button", { name: "Edit Chaat" }).click()
  dialog = page.getByRole("dialog", { name: "Edit Chaat" })
  await dialog.getByRole("switch", { name: "Category on" }).click()
  await dialog.getByRole("button", { name: "Save changes" }).click()
  await expectPreviewToast(page, /Chaat updated/)
  const menuOrder = page.getByRole("region", { name: /Menu order/ })
  await expect(menuOrder.getByRole("listitem").filter({ hasText: "Chaat" })).toContainText("Off")

  await page.getByRole("button", { name: "Delete Chaat" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete category" }).click()
  await expectPreviewToast(page, /Chaat deleted/)
  await expect(menuOrder.getByRole("listitem").filter({ hasText: "Chaat" })).toHaveCount(0)
})

/** The checkbox for one day in the schedule (not its "All day on …" box). */
const dayBox = (page: Page, day: string) =>
  page.getByRole("list", { name: "Days" }).getByRole("checkbox", { name: day, exact: true })
/** Order types for one window or All day entry, e.g. "Monday window 1" or "All day on Saturday". */
const orderTypes = (page: Page, name: string) => page.getByRole("group", { name: `Order types for ${name}` })

test("an item can be scheduled for set days and times, in the restaurant's time zone", async ({ page }) => {
  await gotoAndSettle(page, "/menu/new")
  await page.getByRole("textbox", { name: /Item name/ }).fill("Lunch thali")
  await page.getByRole("combobox", { name: /Category/ }).selectOption({ label: "Mains" })
  await page.getByRole("textbox", { name: /Price/ }).fill("200")

  await page.getByRole("radio", { name: "Only at set times" }).check()
  await expect(page.getByText("Times are in the restaurant's time zone, Asia/Kolkata.")).toBeVisible()

  // Two windows on Monday, then copy Monday to the other weekdays.
  await dayBox(page, "Monday").check()
  await page.getByLabel("From, Monday window 1").fill("12:00")
  await page.getByLabel("To, Monday window 1").fill("15:00")
  await page.getByRole("button", { name: "Add window on Monday" }).click()
  await page.getByLabel("From, Monday window 2").fill("19:00")
  await page.getByLabel("To, Monday window 2").fill("23:00")
  await page.getByRole("button", { name: "Copy Monday to…" }).click()
  const copy = page.getByRole("dialog")
  for (const day of ["Tuesday", "Wednesday", "Thursday", "Friday"]) await copy.getByRole("checkbox", { name: day }).check()
  await copy.getByRole("button", { name: "Copy", exact: true }).click()
  await expect(copy).toHaveCount(0)
  await expect(page.getByLabel("To, Friday window 2")).toHaveValue("23:00")

  // An overnight window belongs to the day it starts (PRD §3.2).
  await dayBox(page, "Saturday").check()
  await page.getByLabel("From, Saturday window 1").fill("22:00")
  await page.getByLabel("To, Saturday window 1").fill("01:00")
  await expect(page.getByText("Runs past midnight into Sunday, ending at 01:00.")).toBeVisible()

  const saves = page.getByText("Saves as").locator("..")
  await expect(saves).toContainText("Mon–Fri 12:00–15:00, 19:00–23:00")
  await expect(saves).toContainText("Sat 22:00–01:00 (+1 day)")

  await page.getByRole("button", { name: "Add item" }).click()
  await expectPreviewToast(page, /Lunch thali added to the menu/)
  await gotoAndSettle(page, "/menu?q=lunch+thali")
  await expect(itemRow(page, "Lunch thali")).toContainText("Mon–Fri 12:00–15:00, 19:00–23:00")
  await expect(itemRow(page, "Lunch thali")).toContainText("Sat 22:00–01:00 (+1 day)")

  // The schedule comes back into the editor.
  await itemRow(page, "Lunch thali").getByRole("link", { name: "Lunch thali" }).click()
  await expect(page.getByRole("radio", { name: "Only at set times" })).toBeChecked()
  await expect(dayBox(page, "Sunday")).not.toBeChecked()
  await expect(page.getByLabel("From, Saturday window 1")).toHaveValue("22:00")
})

test("schedule windows are checked, and overlapping ones are shown merged", async ({ page }) => {
  await gotoAndSettle(page, "/menu/prv-item-01/edit")
  await page.getByRole("radio", { name: "Only at set times" }).check()
  await page.getByRole("button", { name: "Save changes" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toContainText("Choose at least one day, or make the item always available.")

  await dayBox(page, "Wednesday").check()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(summary).toContainText("Enter a start time.")
  await summary.getByRole("link", { name: "Enter a start time." }).click()
  await expect(page.getByLabel("From, Wednesday window 1")).toBeFocused()

  await page.getByLabel("From, Wednesday window 1").fill("09:00")
  await page.getByLabel("To, Wednesday window 1").fill("09:10")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(summary).toContainText("A window must be at least 15 minutes long.")

  await page.getByLabel("To, Wednesday window 1").fill("12:00")
  await page.getByRole("button", { name: "Add window on Wednesday" }).click()
  await page.getByLabel("From, Wednesday window 2").fill("11:00")
  await page.getByLabel("To, Wednesday window 2").fill("14:00")
  await expect(page.getByText("Overlapping windows will be saved as 09:00–14:00.")).toBeVisible()

  // One window can be added to other days, with its order types.
  await page.getByRole("button", { name: "Copy 09:00–12:00 on Wednesday to other days" }).click()
  await page.getByRole("dialog").getByRole("checkbox", { name: "Thursday" }).check()
  await page.getByRole("dialog").getByRole("button", { name: "Add window" }).click()
  await expect(dayBox(page, "Thursday")).toBeChecked()
  await expect(page.getByLabel("From, Thursday window 1")).toHaveValue("09:00")
  await expect(page.getByLabel("To, Thursday window 1")).toHaveValue("12:00")

  // Switching back to always clears the schedule.
  await page.getByRole("radio", { name: "Always available" }).check()
  await expect(page.getByRole("list", { name: "Days" })).toHaveCount(0)
  await page.getByRole("button", { name: "Save changes" }).click()
  await expectPreviewToast(page, /Paneer tikka updated/)
})

test("windows have their own order types, and a day can be All day (Q12, Q13)", async ({ page }) => {
  await gotoAndSettle(page, "/menu/new")
  await page.getByRole("textbox", { name: /Item name/ }).fill("Weekend thali")
  await page.getByRole("combobox", { name: /Category/ }).selectOption({ label: "Mains" })
  await page.getByRole("textbox", { name: /Price/ }).fill("250")
  await page.getByRole("radio", { name: "Only at set times" }).check()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })

  // Monday: dine-in and takeaway at lunch, delivery only in the evening.
  await dayBox(page, "Monday").check()
  await page.getByLabel("From, Monday window 1").fill("11:00")
  await page.getByLabel("To, Monday window 1").fill("15:00")
  await orderTypes(page, "Monday window 1").getByRole("checkbox", { name: "Delivery" }).uncheck()
  await page.getByRole("button", { name: "Add window on Monday" }).click()
  await page.getByLabel("From, Monday window 2").fill("18:00")
  await page.getByLabel("To, Monday window 2").fill("22:00")
  await orderTypes(page, "Monday window 2").getByRole("checkbox", { name: "Takeaway" }).uncheck()
  await orderTypes(page, "Monday window 2").getByRole("checkbox", { name: "Dine-in" }).uncheck()

  // A window needs at least one order type.
  await page.getByRole("button", { name: "Add window on Monday" }).click()
  await page.getByLabel("From, Monday window 3").fill("08:00")
  await page.getByLabel("To, Monday window 3").fill("09:00")
  for (const type of ["Delivery", "Takeaway", "Dine-in"]) {
    await orderTypes(page, "Monday window 3").getByRole("checkbox", { name: type }).uncheck()
  }
  await page.getByRole("button", { name: "Add item" }).click()
  await expect(summary).toContainText("Choose at least one order type.")
  await page.getByRole("button", { name: "Remove Monday window 3" }).click()

  // Saturday: takeaway and dine-in all day, delivery in the evening.
  await dayBox(page, "Saturday").check()
  await page.getByRole("checkbox", { name: "All day on Saturday" }).check()
  // The empty placeholder window goes, so All day starts with every order type.
  await expect(page.getByLabel("From, Saturday window 1")).toHaveCount(0)
  await orderTypes(page, "All day on Saturday").getByRole("checkbox", { name: "Delivery" }).uncheck()
  await page.getByRole("button", { name: "Add window on Saturday" }).click()
  // A new window starts with the order types that aren't available all day.
  await expect(orderTypes(page, "Saturday window 1").getByRole("checkbox", { name: "Delivery" })).toBeChecked()
  await expect(orderTypes(page, "Saturday window 1").getByRole("checkbox", { name: "Takeaway" })).not.toBeChecked()
  await page.getByLabel("From, Saturday window 1").fill("18:00")
  await page.getByLabel("To, Saturday window 1").fill("22:00")

  // Takeaway is already available all day, so a timed takeaway window is refused.
  await orderTypes(page, "Saturday window 1").getByRole("checkbox", { name: "Takeaway" }).check()
  await page.getByRole("button", { name: "Add item" }).click()
  await expect(summary).toContainText("Takeaway is already available all day on Saturday.")
  await orderTypes(page, "Saturday window 1").getByRole("checkbox", { name: "Takeaway" }).uncheck()

  const saves = page.getByText("Saves as").locator("..")
  await expect(saves).toContainText("Mon 11:00–15:00 (Takeaway, Dine-in), 18:00–22:00 (Delivery)")
  await expect(saves).toContainText("Sat All day (Takeaway, Dine-in), 18:00–22:00 (Delivery)")

  // The item's own order types are the outer limit.
  await page.getByRole("group", { name: "Order types", exact: true }).getByRole("checkbox", { name: "Delivery" }).uncheck()
  await page.getByRole("button", { name: "Add item" }).click()
  await expect(summary).toContainText("Delivery is off for this item.")
  await page.getByRole("group", { name: "Order types", exact: true }).getByRole("checkbox", { name: "Delivery" }).check()

  await page.getByRole("button", { name: "Add item" }).click()
  await expectPreviewToast(page, /Weekend thali added to the menu/)
  await gotoAndSettle(page, "/menu?q=weekend+thali")
  const row = itemRow(page, "Weekend thali")
  await expect(row).toContainText("Mon 11:00–15:00 (Takeaway, Dine-in), 18:00–22:00 (Delivery)")
  await expect(row).toContainText("Sat All day (Takeaway, Dine-in), 18:00–22:00 (Delivery)")

  // Editing brings back All day and each window's order types.
  await row.getByRole("link", { name: "Weekend thali" }).click()
  await expect(page.getByRole("checkbox", { name: "All day on Saturday" })).toBeChecked()
  await expect(orderTypes(page, "All day on Saturday").getByRole("checkbox", { name: "Delivery" })).not.toBeChecked()
  await expect(orderTypes(page, "Monday window 2").getByRole("checkbox", { name: "Delivery" })).toBeChecked()
  await expect(orderTypes(page, "Monday window 2").getByRole("checkbox", { name: "Dine-in" })).not.toBeChecked()
})

test("sample schedules show in the list and the editor", async ({ page }) => {
  await gotoAndSettle(page, "/menu?q=chicken+biryani")
  await expect(itemRow(page, "Chicken biryani")).toContainText("Mon–Fri 12:00–15:30, 19:00–23:00")
  await expect(itemRow(page, "Chicken biryani")).toContainText("Sat, Sun 12:00–23:30")
  await gotoAndSettle(page, "/menu?q=butter+chicken")
  await expect(itemRow(page, "Butter chicken")).toContainText("Mon–Fri 11:00–15:00 (Takeaway, Dine-in), 18:00–22:00 (Delivery)")
  await gotoAndSettle(page, "/menu?q=filter+coffee")
  await expect(itemRow(page, "Filter coffee")).toContainText("Sat, Sun All day (Takeaway, Dine-in), 18:00–22:00 (Delivery)")

  await gotoAndSettle(page, "/menu/prv-item-14/edit")
  await expect(page.getByRole("heading", { level: 1, name: "Edit Chicken biryani" })).toBeVisible()
  await expect(page.getByLabel("To, Sunday window 1")).toHaveValue("23:30")
  // The item's order types sit beside the schedule.
  await expect(page.getByRole("group", { name: "Order types", exact: true }).getByRole("checkbox", { name: "Delivery" })).toBeChecked()
})

// ----- B3b: meal periods, category schedules and the restaurant-hours check -----
// In this file so they run in series with the other menu tests: they share the
// preview menu store. Restaurant hours are the B3a sample hours (delivery
// Mon–Thu 11:00–15:00 and 18:00–23:30, dine-in every day 12:00–15:00 and
// 19:00–23:00).
test.describe("meal periods and category schedules (B3b)", () => {
  const periodRow = (page: Page, name: string) =>
    page.locator("main li").filter({ has: page.getByText(name, { exact: true }) }).first()
  const hoursCheck = (page: Page) => page.getByRole("region", { name: "Check against restaurant hours" })

  // The hours check reads the preview restaurant hours, so start from the
  // sample hours too, whatever ran before.
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/hours")
    await page.getByRole("button", { name: "Reset sample hours" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
  })

  test("add a meal period with validation, then edit a shared one and see what uses it", async ({ page }) => {
    await gotoAndSettle(page, "/menu/meal-periods")
    await expect(page.getByRole("note").filter({ hasText: PREVIEW_LABEL })).toContainText("A real restaurant starts with none.")

    await page.getByRole("button", { name: "Add meal period" }).click()
    let dialog = page.getByRole("dialog", { name: "Add meal period" })
    await dialog.getByRole("button", { name: "Add meal period" }).click()
    await expect(dialog.getByText("Enter the meal period name.")).toBeVisible()
    await expect(dialog.getByText("Choose at least one day.")).toBeVisible()
    await expect(dialog.getByRole("textbox", { name: /Name/ })).toBeFocused()

    await dialog.getByRole("textbox", { name: /Name/ }).fill("lunch")
    await dialog.getByRole("checkbox", { name: "Sunday", exact: true }).check()
    await dialog.getByLabel("From, Sunday window 1").fill("10:00")
    await dialog.getByLabel("To, Sunday window 1").fill("13:00")
    await expect(dialog.getByLabel("Saves as")).toContainText("Sun 10:00–13:00")
    await dialog.getByRole("button", { name: "Add meal period" }).click()
    await expect(dialog.getByText("Another meal period already has this name.")).toBeVisible()
    await dialog.getByRole("textbox", { name: /Name/ }).fill("Brunch")
    await dialog.getByRole("button", { name: "Add meal period" }).click()
    await expectPreviewToast(page, /Brunch added/)
    await expect(periodRow(page, "Brunch")).toContainText("Not used by any item or category")

    // Editing a shared period lists what uses it; their order types stay as they are.
    await page.getByRole("button", { name: "Edit Lunch" }).click()
    dialog = page.getByRole("dialog", { name: "Edit Lunch" })
    await expect(dialog.getByRole("note")).toContainText("Changing the times changes them for the 2 items that use Lunch")
    await expect(dialog.getByRole("note")).toContainText("Lemon rice")
    await expect(dialog.getByRole("note")).toContainText("Paneer butter masala")
    await dialog.getByLabel("To, Monday window 1").fill("15:30")
    await dialog.getByRole("button", { name: "Save changes" }).click()
    await expectPreviewToast(page, /Lunch updated/)
    await expect(periodRow(page, "Lunch")).toContainText("Mon 12:00–15:30 · Tue–Fri 12:00–15:00 · Sat, Sun 12:00–16:00")
  })

  test("archive is refused while in use; unused periods archive, restore and delete", async ({ page }) => {
    await gotoAndSettle(page, "/menu/meal-periods")
    // Used on orders, so it can't be deleted at all.
    await expect(periodRow(page, "Lunch").getByRole("button", { name: /Delete/ })).toHaveCount(0)

    await page.getByRole("button", { name: "Archive Lunch" }).click()
    let confirm = page.getByRole("alertdialog", { name: "Archive Lunch?" })
    await expect(confirm).toContainText("Lunch is used by 2 items.")
    await confirm.getByRole("button", { name: "Archive meal period" }).click()
    await expect(confirm.getByText("Lunch is used by 2 items. Change their schedules first.")).toBeVisible()
    await confirm.getByRole("button", { name: "Go back" }).click()

    await page.getByRole("button", { name: "Archive Late night" }).click()
    confirm = page.getByRole("alertdialog", { name: "Archive Late night?" })
    await confirm.getByRole("button", { name: "Archive meal period" }).click()
    await expectPreviewToast(page, /Late night archived/)
    const archived = page.getByRole("list", { name: /Archived/ })
    await expect(archived).toContainText("Late night")
    await page.getByRole("button", { name: "Restore Late night" }).click()
    await expectPreviewToast(page, /Late night restored/)
    await expect(archived).not.toContainText("Late night")

    await page.getByRole("button", { name: "Delete Afternoon tea" }).click()
    confirm = page.getByRole("alertdialog", { name: "Delete Afternoon tea?" })
    await confirm.getByRole("button", { name: "Delete meal period" }).click()
    await expectPreviewToast(page, /Afternoon tea deleted/)
    await expect(page.locator("main")).not.toContainText("Afternoon tea")
  })

  test("an item uses a meal period for some of its order types, with an hours warning", async ({ page }) => {
    await gotoAndSettle(page, "/menu/prv-item-05/edit")
    await page.getByRole("radio", { name: "During meal periods" }).check()
    await page.getByRole("checkbox", { name: "Dinner" }).check()
    // H1: the item chooses which of its order types use the period.
    const dinnerTypes = page.getByRole("group", { name: "Order types for Dinner" })
    await dinnerTypes.getByRole("checkbox", { name: "Takeaway" }).uncheck()
    await dinnerTypes.getByRole("checkbox", { name: "Dine-in" }).uncheck()

    // Dinner runs to 23:00; Sunday delivery ends at 22:00.
    const check = hoursCheck(page)
    await expect(check).toContainText("Delivery: part of the schedule is outside delivery hours.")
    await expect(check).toContainText("Sun 22:00–23:00")
    await expect(check).toContainText("Advisory only; it never stops you saving.")
    await expect(check).toContainText("special dates")

    await page.getByRole("button", { name: "Save changes" }).click()
    await expectPreviewToast(page, /Dal makhani updated/)
    await expect(itemRow(page, "Dal makhani")).toContainText("Dinner (Delivery)")
    await gotoAndSettle(page, "/menu/meal-periods")
    await expect(periodRow(page, "Dinner")).toContainText("Used by 2 items")
  })

  test("Convert to custom times copies the current times and warns when the period changed", async ({ page, context }) => {
    await gotoAndSettle(page, "/menu/prv-item-15/edit")

    // Someone changes Lunch after this editor loaded.
    const other = await context.newPage()
    await other.goto("/menu/meal-periods")
    await other.waitForLoadState("networkidle")
    await other.getByRole("button", { name: "Edit Lunch" }).click()
    const edit = other.getByRole("dialog", { name: "Edit Lunch" })
    await edit.getByLabel("To, Monday window 1").fill("15:30")
    await edit.getByRole("button", { name: "Save changes" }).click()
    await expect(other.locator('[data-slot="toast"]').filter({ hasText: /Lunch updated/ }).last()).toBeVisible()
    await other.close()

    await page.getByRole("button", { name: "Convert to custom times" }).click()
    const confirm = page.getByRole("alertdialog", { name: "Meal periods changed since you opened this page" })
    await expect(confirm).toContainText("Lunch: now Mon 12:00–15:30; Tue–Fri 12:00–15:00; Sat, Sun 12:00–16:00")
    await expect(confirm).toContainText("This page showed Mon–Fri 12:00–15:00; Sat, Sun 12:00–16:00.")
    await confirm.getByRole("button", { name: "Convert with current times" }).click()

    await expect(page.getByRole("radio", { name: "Only at set times" })).toBeChecked()
    await expect(page.getByRole("status").filter({ hasText: "Converted from Lunch." })).toContainText("the meal period isn't changed")
    await expect(page.getByText("Saves as").locator("..")).toContainText("Mon 12:00–15:30")
    await expect(page.getByText("Saves as").locator("..")).toContainText("Sat, Sun 12:00–16:00")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expectPreviewToast(page, /Lemon rice updated/)
    await gotoAndSettle(page, "/menu?q=lemon+rice")
    await expect(itemRow(page, "Lemon rice")).toContainText("Mon 12:00–15:30")

    // The shared definition isn't changed by converting; Lemon rice just stops using it.
    await gotoAndSettle(page, "/menu/meal-periods")
    await expect(periodRow(page, "Lunch")).toContainText("Mon 12:00–15:30 · Tue–Fri 12:00–15:00")
    await expect(periodRow(page, "Lunch")).toContainText("Used by 1 item")

    // Unchanged since loading: converts straight away.
    await gotoAndSettle(page, "/menu/prv-item-06/edit")
    await page.getByRole("button", { name: "Convert to custom times" }).click()
    await expect(page.getByRole("radio", { name: "Only at set times" })).toBeChecked()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "Converted from Lunch, Dinner." })).toBeVisible()
  })

  test("a category schedule stays within the category's order types; items show the category's limits", async ({ page }) => {
    await gotoAndSettle(page, "/menu/categories")
    await page.getByRole("button", { name: "Edit Desserts" }).click()
    const dialog = page.getByRole("dialog", { name: "Edit Desserts" })
    await dialog.getByRole("group", { name: "Order types", exact: true }).getByRole("checkbox", { name: "Delivery" }).uncheck()
    await dialog.getByRole("radio", { name: "Only at set times" }).check()
    await dialog.getByRole("checkbox", { name: "Monday", exact: true }).check()
    await dialog.getByLabel("From, Monday window 1").fill("12:00")
    await dialog.getByLabel("To, Monday window 1").fill("16:00")
    // A child never enables an order type its category has off.
    const windowTypes = dialog.getByRole("group", { name: "Order types for Monday window 1" })
    await expect(windowTypes.getByRole("checkbox", { name: "Delivery" })).toBeDisabled()
    await expect(windowTypes).toContainText("Delivery is off for this category.")
    await expectNoSeriousA11yViolations(page)
    await expectNoHorizontalOverflow(page)
    await dialog.getByRole("button", { name: "Save changes" }).click()
    await expectPreviewToast(page, /Desserts updated/)
    await expect(page.locator("main li").filter({ hasText: "Desserts" }).first()).toContainText("Only: Mon 12:00–16:00")

    // Rasmalai keeps its own delivery setting (B2 save rule) but isn't orderable for it.
    await gotoAndSettle(page, "/menu/prv-item-17/edit")
    const types = page.getByRole("group", { name: "Order types", exact: true })
    await expect(types.getByRole("checkbox", { name: /Delivery/ })).toBeChecked()
    await expect(types.getByRole("checkbox", { name: /Delivery/ })).toBeEnabled()
    await expect(types).toContainText("Delivery is off for the Desserts category, so this item can't be ordered for it.")
    await expect(types).toContainText("Configured: Delivery, Takeaway and Dine-in. Orderable for: Takeaway and Dine-in.")
    // The category's Monday 12:00–16:00 runs past dine-in's 15:00.
    await expect(hoursCheck(page)).toContainText("Dine-in: part of the schedule is outside dine-in hours.")
    await expect(hoursCheck(page)).toContainText("Mon 15:00–16:00")

    // An item schedule that never meets its category's gets the stronger warning, and still saves.
    await page.getByRole("radio", { name: "Only at set times" }).check()
    await page.getByRole("checkbox", { name: "Tuesday", exact: true }).check()
    await page.getByLabel("From, Tuesday window 1").fill("12:00")
    await page.getByLabel("To, Tuesday window 1").fill("13:00")
    await expect(hoursCheck(page)).toContainText("This item may never be orderable")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expectPreviewToast(page, /Rasmalai updated/)

    // Kulfi has delivery off itself; with the category off too, it can't be turned on here.
    await gotoAndSettle(page, "/menu/prv-item-18/edit")
    await expect(page.getByRole("group", { name: "Order types", exact: true }).getByRole("checkbox", { name: /Delivery/ })).toBeDisabled()
  })

  test("a fully contained schedule shows no conflicts", async ({ page }) => {
    await gotoAndSettle(page, "/menu/prv-item-05/edit")
    await expect(hoursCheck(page)).toContainText("No conflicts with weekly restaurant hours.")
    // A takeaway-only item during Lunch: takeaway is open weekdays 11:00–22:00 and all day at weekends.
    const types = page.getByRole("group", { name: "Order types", exact: true })
    await types.getByRole("checkbox", { name: "Delivery" }).uncheck()
    await types.getByRole("checkbox", { name: "Dine-in" }).uncheck()
    await page.getByRole("radio", { name: "During meal periods" }).check()
    await page.getByRole("checkbox", { name: "Lunch" }).check()
    await expect(page.getByRole("group", { name: "Order types for Lunch" }).getByRole("checkbox", { name: "Takeaway" })).toBeChecked()
    await expect(hoursCheck(page)).toContainText("No conflicts with weekly restaurant hours.")
    await expect(hoursCheck(page)).not.toContainText("Unable to evaluate schedule")
  })

  test("meal periods can be chosen with the keyboard", async ({ page }) => {
    await gotoAndSettle(page, "/menu/prv-item-05/edit")
    await page.getByRole("radio", { name: "Always available" }).focus()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("radio", { name: "During meal periods" })).toBeChecked()
    await expect(page.getByRole("radio", { name: "During meal periods" })).toBeFocused()

    await page.keyboard.press("Tab")
    await expect(page.getByRole("checkbox", { name: "Breakfast" })).toBeFocused()
    await page.keyboard.press("Space")
    await expect(page.getByRole("checkbox", { name: "Breakfast" })).toBeChecked()
    await page.keyboard.press("Tab")
    const breakfastTypes = page.getByRole("group", { name: "Order types for Breakfast" })
    await expect(breakfastTypes.getByRole("checkbox", { name: "Delivery" })).toBeFocused()
    await page.keyboard.press("Space")
    await expect(breakfastTypes.getByRole("checkbox", { name: "Delivery" })).not.toBeChecked()
    // Breakfast (07:00–11:00) is before every restaurant opening on weekdays.
    await expect(hoursCheck(page)).toContainText("Dine-in: the schedule is never within dine-in hours.")
  })
})
