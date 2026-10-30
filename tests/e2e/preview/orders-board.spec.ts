import { expect, test, type Locator, type Page } from "@playwright/test"

import { expectNoConsoleErrors, gotoAndSettle } from "../helpers"

// Order workflows against preview data. They change the shared preview store,
// so they run one at a time and each starts from reset sample orders.
test.describe.configure({ mode: "serial" })

const PREVIEW_LABEL = "Preview only, not saved to Foodi"

async function resetSampleOrders(page: Page) {
  await gotoAndSettle(page, "/orders")
  await page.getByRole("button", { name: "Reset sample orders" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await gotoAndSettle(page, "/orders")
}

const column = (page: Page, name: "New" | "In kitchen" | "Ready" | "Scheduled") =>
  page.getByRole("region", { name: new RegExp(`^${name}`) })

const cards = (scope: Locator) => scope.getByRole("article")

async function referenceOf(card: Locator) {
  return (await card.getByRole("heading", { level: 3 }).innerText()).trim()
}

async function expectPreviewToast(page: Page, text: RegExp) {
  // The toast itself; Radix's hidden "status" announcement only lasts about a second.
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: text }).last()
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(PREVIEW_LABEL)
}

test.beforeEach(async ({ page }) => {
  await resetSampleOrders(page)
})

test.afterEach(async ({ page }) => {
  expectNoConsoleErrors(page)
})

test("the board shows each column and the new-order alarm", async ({ page }) => {
  await expect(cards(column(page, "New"))).toHaveCount(3)
  await expect(cards(column(page, "In kitchen"))).toHaveCount(4)
  await expect(cards(column(page, "Ready"))).toHaveCount(5)
  await expect(cards(column(page, "Scheduled"))).toHaveCount(2)
  await expect(page.getByRole("alert").filter({ hasText: /new orders are waiting/i })).toBeVisible()
  await expect(page.getByText("Updating every 15 s")).toBeVisible()
  // No separate "Start preparing" step in Release 1 (Q10).
  await expect(page.getByRole("button", { name: /start preparing/i })).toHaveCount(0)
})

test("accepting a new order with a prep time moves it to the kitchen", async ({ page }) => {
  const card = cards(column(page, "New")).first()
  const reference = await referenceOf(card)
  await card.getByRole("button", { name: `Accept for ${reference}` }).click()

  const dialog = page.getByRole("alertdialog", { name: `Accept order ${reference}?` })
  await dialog.getByRole("radio", { name: "15 min" }).check()
  await dialog.getByRole("button", { name: "Accept order" }).click()

  await expectPreviewToast(page, new RegExp(`Order ${reference} accepted`))
  const kitchenCard = column(page, "In kitchen").getByRole("article", { name: reference })
  await expect(kitchenCard).toBeVisible()
  await expect(kitchenCard).toContainText(/1[45] min left/)
})

test("accepting works with the keyboard alone", async ({ page }) => {
  const card = cards(column(page, "New")).first()
  const reference = await referenceOf(card)
  await card.getByRole("button", { name: `Accept for ${reference}` }).focus()
  await page.keyboard.press("Enter")

  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(dialog.getByRole("button", { name: "Accept order" })).toBeFocused()
  await page.keyboard.press("Enter")

  await expectPreviewToast(page, new RegExp(`Order ${reference} accepted`))
  await expect(column(page, "In kitchen").getByRole("article", { name: reference })).toBeVisible()
})

test("rejecting requires a reason, and a note for Other", async ({ page }) => {
  const card = cards(column(page, "New")).first()
  const reference = await referenceOf(card)
  await card.getByRole("button", { name: `Reject for ${reference}` }).click()

  const dialog = page.getByRole("alertdialog", { name: `Reject order ${reference}?` })
  await dialog.getByRole("button", { name: "Reject order" }).click()
  await expect(dialog.getByText("Choose a reason.")).toBeVisible()

  await dialog.getByRole("radio", { name: "Other" }).check()
  await dialog.getByRole("button", { name: "Reject order" }).click()
  await expect(dialog.getByText("Add a short explanation for this reason.")).toBeVisible()

  await dialog.getByRole("textbox").fill("Gas supply cut")
  await dialog.getByRole("button", { name: "Reject order" }).click()
  await expectPreviewToast(page, new RegExp(`Order ${reference} rejected`))
  await expect(page.getByRole("article", { name: reference })).toHaveCount(0)

  await gotoAndSettle(page, `/orders/${reference.toLowerCase()}`)
  await expect(page.getByText(/Rejected by your restaurant:\s*Other \(Gas supply cut\)/)).toBeVisible()
})

test("cancelling an order in the kitchen explains stock and refund, then records the reason", async ({ page }) => {
  const card = cards(column(page, "In kitchen")).first()
  const reference = await referenceOf(card)
  await card.getByRole("button", { name: `Cancel order for ${reference}` }).click()

  const dialog = page.getByRole("alertdialog", { name: `Cancel order ${reference}?` })
  await expect(dialog).toContainText("reserved stock isn't returned")
  await dialog.getByRole("radio", { name: "Kitchen issue" }).check()
  await dialog.getByRole("button", { name: "Cancel order" }).click()

  await expectPreviewToast(page, new RegExp(`Order ${reference} cancelled`))
  await gotoAndSettle(page, `/orders/${reference.toLowerCase()}`)
  await expect(page.getByText(/Cancelled by your restaurant:\s*Kitchen issue/)).toBeVisible()
  await expect(page.getByText("Stock not returned")).toBeVisible()
})

test("a refund is shown as pending, never as completed", async ({ page }) => {
  const card = cards(column(page, "In kitchen")).filter({ hasText: "Online · Paid" }).first()
  const reference = await referenceOf(card)
  await card.getByRole("button", { name: `Cancel order for ${reference}` }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("The refund shows as pending until the payment provider confirms it.")
  await dialog.getByRole("radio", { name: "Customer request" }).check()
  await dialog.getByRole("button", { name: "Cancel order" }).click()
  await expectPreviewToast(page, /cancelled/)

  await gotoAndSettle(page, `/orders/${reference.toLowerCase()}`)
  await expect(page.getByText("Refund pending")).toBeVisible()
  await expect(page.getByText(/^Refunded$/)).toHaveCount(0)
})

test("Foodi rider orders can't be cancelled from the panel", async ({ page }) => {
  const card = column(page, "Ready").getByRole("article").filter({ hasText: "A Foodi rider is delivering this order" })
  await expect(card).toHaveCount(1)
  await expect(card.getByRole("button", { name: /cancel order/i })).toHaveCount(0)
  await expect(card).toContainText("Contact Foodi support to cancel it.")
})

test("cancelling an own-rider delivery needs the rider confirmation", async ({ page }) => {
  const card = column(page, "Ready")
    .getByRole("article")
    .filter({ hasText: "Out for delivery" })
    .filter({ hasText: "Delivery · own rider" })
  const reference = await referenceOf(card)
  await card.getByRole("button", { name: `Cancel order for ${reference}` }).click()

  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("radio", { name: "Closing early" }).check()
  await dialog.getByRole("button", { name: "Cancel order" }).click()
  await expect(dialog.getByText("Confirm that you'll tell the rider to stop.")).toBeVisible()

  await dialog.getByRole("checkbox").check()
  await dialog.getByRole("button", { name: "Cancel order" }).click()
  await expectPreviewToast(page, new RegExp(`Order ${reference} cancelled`))
})

test("mark ready, then dispatch an own-rider order", async ({ page }) => {
  const kitchenCard = cards(column(page, "In kitchen")).first()
  const kitchenReference = await referenceOf(kitchenCard)
  await kitchenCard.getByRole("button", { name: `Mark ready for ${kitchenReference}` }).click()
  await expectPreviewToast(page, new RegExp(`Order ${kitchenReference} marked ready`))
  await expect(column(page, "Ready").getByRole("article", { name: kitchenReference })).toBeVisible()

  const readyCard = column(page, "Ready").getByRole("article").filter({ has: page.getByRole("button", { name: /^Dispatch/ }) }).first()
  const reference = await referenceOf(readyCard)
  await readyCard.getByRole("button", { name: `Dispatch for ${reference}` }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Dispatch" }).click()
  await expect(dialog.getByText("Choose a rider.")).toBeVisible()
  await dialog.getByRole("radio", { name: "Preview rider B" }).check()
  await dialog.getByRole("button", { name: "Dispatch" }).click()

  await expectPreviewToast(page, new RegExp(`Order ${reference} dispatched`))
  const dispatched = column(page, "Ready").getByRole("article", { name: reference })
  await expect(dispatched).toContainText("Out for delivery")
  await expect(dispatched).toContainText("Preview rider B")
})

test("adjusting prep time extends the ready-by time", async ({ page }) => {
  await gotoAndSettle(page, "/orders/prv-1007")
  const before = await page.getByText(/ready by/).first().innerText()
  await page.getByRole("button", { name: "Adjust prep time for PRV-1007" }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("radio", { name: "+10 min" }).check()
  await dialog.getByRole("button", { name: "Add time" }).click()
  await expectPreviewToast(page, /extended by 10 min/)
  await expect(page.getByText(/ready by/).first()).not.toHaveText(before)
  await expect(page.getByText("Prep time adjusted")).toBeVisible()
})

test("a simulated new order rings the alarm until acknowledged", async ({ page }) => {
  await page.getByRole("button", { name: "Acknowledge" }).click()
  await expect(page.getByRole("alert").filter({ hasText: /waiting/ })).toHaveCount(0)

  await page.getByRole("button", { name: "Simulate a new order" }).click()
  await expectPreviewToast(page, /Sample order PRV-2001 placed/)
  const alarm = page.getByRole("alert").filter({ hasText: "New order PRV-2001 is waiting" })
  await expect(alarm).toBeVisible()
  await expect(column(page, "New").getByRole("article", { name: "PRV-2001" })).toBeVisible()

  await alarm.getByRole("button", { name: "Acknowledge" }).click()
  await expect(alarm).toHaveCount(0)
})

test("the alarm sound is opt-in", async ({ page }) => {
  const toggle = page.getByRole("button", { name: /alarm sound/i })
  await expect(toggle).toHaveAttribute("aria-pressed", "false")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await expect(toggle).toHaveText(/on/)
})

test("a repeated click doesn't apply a command twice", async ({ page }) => {
  await gotoAndSettle(page, "/orders/prv-1007")
  const markReady = page.getByRole("button", { name: "Mark ready for PRV-1007" })
  await markReady.dblclick()
  await expectPreviewToast(page, /marked ready/)
  await expect(page.getByText(/^Ready$/).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole("listitem").filter({ hasText: /^Ready/ })).toHaveCount(1)
})
