import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Reviews (B6a) against preview data. Replies and reports change the shared
// preview reviews, so this file runs one test at a time and each starts from
// the reset sample reviews (like settings and hours). No other spec writes
// reviews. Each test that changes a review has its own review, so no two
// tests depend on the same record:
//   reply happy path prv-rev-005, failed reply prv-rev-008, keyboard reply
//   prv-rev-013, refused as non-owner prv-rev-020, report prv-rev-009,
//   report "Other" prv-rev-012, failed report prv-rev-016, keyboard report
//   prv-rev-024.
test.describe.configure({ mode: "serial" })

const PREVIEW_LABEL = "Preview only, not saved to Foodi"
const REQUEST_FAILED = "Your request couldn't be sent, so nothing was changed. Check your connection and try again."

async function resetSampleReviews(page: Page) {
  await gotoAndSettle(page, "/reviews")
  await page.getByRole("button", { name: "Reset sample reviews" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
}

async function expectPreviewToast(page: Page, text: RegExp) {
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: text }).last()
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(PREVIEW_LABEL)
}

/** The review links on the page, whichever of the table or the cards is shown at this width. */
const reviewLinks = (page: Page) => page.locator('main a[href^="/reviews/prv-rev-"]').filter({ visible: true })
const reviewHrefs = async (page: Page) => reviewLinks(page).evaluateAll((links) => links.map((link) => link.getAttribute("href")!.split("?")[0]))
const stars = (page: Page, pattern: RegExp) => page.getByRole("img", { name: pattern }).filter({ visible: true })

/** Aborts the browser's Server Action requests, as a dropped connection would, and records their bodies. */
async function failActionRequests(page: Page, path: string, failures: number) {
  const bodies: string[] = []
  let remaining = failures
  await page.route(`**${path}`, (route) => {
    const request = route.request()
    if (request.method() === "POST" && request.headers()["next-action"] && remaining > 0) {
      remaining -= 1
      bodies.push(request.postData() ?? "")
      return route.abort("failed")
    }
    return route.continue()
  })
  return bodies
}

/**
 * Its own page, for a test that aborts a request on purpose: Chromium logs the
 * aborted request as a console error, so the shared check can't be used. Here
 * only that message is allowed, and an uncaught page error still fails.
 */
async function newPageForAbortedRequests(context: BrowserContext) {
  const page = await context.newPage()
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()))
  page.on("pageerror", (error) => pageErrors.push(error.message))
  return {
    page,
    async finish() {
      expect(pageErrors).toEqual([])
      expect(consoleErrors.every((text) => /Failed to load resource|ERR_FAILED/.test(text)), consoleErrors.join("\n")).toBe(true)
      await page.close()
    },
  }
}

const idempotencyKeyIn = (body: string) => body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0]

test.beforeEach(async ({ page }) => {
  await resetSampleReviews(page)
})

test.afterEach(async ({ page }) => {
  expectNoConsoleErrors(page)
})

test.describe("list", () => {
  test("shows the newest reviews first, ten to a page, labelled as preview data", async ({ page }) => {
    await gotoAndSettle(page, "/reviews")
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible()
    await expect(page.getByRole("note").filter({ hasText: PREVIEW_LABEL })).toBeVisible()

    expect(await reviewHrefs(page)).toEqual(Array.from({ length: 10 }, (_, index) => `/reviews/prv-rev-${String(index + 1).padStart(3, "0")}`))
    await expect(page.getByText("Showing 1–10 of 28 reviews")).toBeVisible()
    await expect(page.getByText("Page 1 of 3")).toBeVisible()
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled()
    await expect(page.getByRole("navigation", { name: "Filter reviews by rating" }).getByRole("link", { name: "All ratings" })).toHaveAttribute("aria-current", "page")
    await expect(page.getByRole("navigation", { name: "Filter reviews by reply status" }).getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "page")
    // A rating-only review says so, and a review without a name says so; no contact details anywhere.
    await expect(page.getByText("Rating only, no written review").filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText("Name not shared").filter({ visible: true }).first()).toBeVisible()
    await expect(page.locator("main")).not.toContainText(/@|\+\d{2}|\d{10}/)
  })

  test("filters by rating and reply status, with the reset", async ({ page }) => {
    await gotoAndSettle(page, "/reviews")
    const ratingNav = page.getByRole("navigation", { name: "Filter reviews by rating" })
    const repliedNav = page.getByRole("navigation", { name: "Filter reviews by reply status" })

    await ratingNav.getByRole("link", { name: "5 stars" }).click()
    await expect(page).toHaveURL(/\/reviews\?rating=5$/)
    await expect(page.getByText("Showing 1–10 of 10 reviews")).toBeVisible()
    await expect(ratingNav.getByRole("link", { name: "5 stars" })).toHaveAttribute("aria-current", "page")
    await expect(stars(page, /^[1-4] out of 5 stars$/)).toHaveCount(0)
    expect(await stars(page, /^5 out of 5 stars$/).count()).toBe(10)

    await repliedNav.getByRole("link", { name: "Not replied" }).click()
    await expect(page).toHaveURL(/\/reviews\?rating=5&replied=unreplied$/)
    await expect(page.getByText("Showing 1–7 of 7 reviews")).toBeVisible()
    // The badges are spans; the filter above them is made of links.
    await expect(page.locator("main span", { hasText: /^Replied$/ }).filter({ visible: true })).toHaveCount(0)

    await repliedNav.getByRole("link", { name: "Replied", exact: true }).click()
    await expect(page).toHaveURL(/\/reviews\?rating=5&replied=replied$/)
    await expect(page.getByText("Showing 1–3 of 3 reviews")).toBeVisible()

    await page.getByRole("link", { name: "Reset filters" }).click()
    await expect(page).toHaveURL(/\/reviews$/)
    await expect(page.getByText("Showing 1–10 of 28 reviews")).toBeVisible()
    await expect(page.getByRole("link", { name: "Reset filters" })).toHaveCount(0)
  })

  test("a filter that matches nothing offers a reset", async ({ page }) => {
    // No 2-star review has a reply.
    await gotoAndSettle(page, "/reviews?rating=2&replied=replied")
    await expect(page.getByText("No reviews match these filters")).toBeVisible()
    await expect(page.getByRole("table")).toHaveCount(0)
    await page.getByRole("main").getByRole("link", { name: "Reset filters" }).last().click()
    await expect(page).toHaveURL(/\/reviews$/)
    await expect(page.getByText("Showing 1–10 of 28 reviews")).toBeVisible()
  })

  test("paginates, and the page and filters survive a reload and browser history", async ({ page }) => {
    await gotoAndSettle(page, "/reviews")
    await page.getByRole("link", { name: "Next page" }).click()
    await expect(page).toHaveURL(/\/reviews\?page=2$/)
    await expect(page.getByText("Showing 11–20 of 28 reviews")).toBeVisible()
    expect((await reviewHrefs(page))[0]).toBe("/reviews/prv-rev-011")

    await page.reload()
    await expect(page.getByText("Page 2 of 3")).toBeVisible()
    expect((await reviewHrefs(page))[0]).toBe("/reviews/prv-rev-011")

    await page.getByRole("link", { name: "Next page" }).click()
    await expect(page.getByText("Showing 21–28 of 28 reviews")).toBeVisible()
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()

    await page.goBack()
    await expect(page).toHaveURL(/\/reviews\?page=2$/)
    await expect(page.getByText("Page 2 of 3")).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/reviews$/)
    await expect(page.getByText("Page 1 of 3")).toBeVisible()
    await page.goForward()
    await expect(page.getByText("Page 2 of 3")).toBeVisible()

    // A filter on the second page goes back to page 1 and survives a reload too.
    await page.getByRole("navigation", { name: "Filter reviews by reply status" }).getByRole("link", { name: "Not replied" }).click()
    await expect(page).toHaveURL(/\/reviews\?replied=unreplied$/)
    await page.reload()
    await expect(page.getByText("Showing 1–10 of 20 reviews")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Filter reviews by reply status" }).getByRole("link", { name: "Not replied" })).toHaveAttribute("aria-current", "page")
  })

  test("treats invalid URL parameters as the defaults, and an out-of-range page as the last page", async ({ page }) => {
    await gotoAndSettle(page, "/reviews?rating=9&replied=maybe&page=-3")
    await expect(page.getByText("Showing 1–10 of 28 reviews")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Filter reviews by rating" }).getByRole("link", { name: "All ratings" })).toHaveAttribute("aria-current", "page")
    await expect(page.getByRole("link", { name: "Reset filters" })).toHaveCount(0)

    await gotoAndSettle(page, "/reviews?page=99")
    await expect(page.getByText("Page 3 of 3")).toBeVisible()
    await expect(page.getByText("Showing 21–28 of 28 reviews")).toBeVisible()
    // Links from a clamped page carry the page actually shown.
    expect(await reviewLinks(page).first().getAttribute("href")).toBe("/reviews/prv-rev-021?page=3")
  })

  test("opens a review with the list's filters kept, and comes back to the same view", async ({ page }) => {
    await gotoAndSettle(page, "/reviews?rating=5&replied=unreplied")
    const first = reviewLinks(page).first()
    const href = (await first.getAttribute("href"))!
    expect(href).toMatch(/^\/reviews\/prv-rev-\d{3}\?rating=5&replied=unreplied$/)
    await first.click()
    await expect(page).toHaveURL(new RegExp(`${href.replace("?", "\\?")}$`))
    await expect(page.getByRole("heading", { level: 1, name: /^Review by / })).toBeVisible()

    await page.getByRole("link", { name: "All reviews" }).click()
    await expect(page).toHaveURL(/\/reviews\?rating=5&replied=unreplied$/)
    await expect(page.getByText("Showing 1–7 of 7 reviews")).toBeVisible()

    // The browser's back button works from the detail page too.
    await reviewLinks(page).first().click()
    await expect(page).toHaveURL(/\/reviews\/prv-rev-\d{3}\?rating=5&replied=unreplied$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/reviews\?rating=5&replied=unreplied$/)
  })
})

test.describe("states", () => {
  test("an empty source says there are no reviews, with no table and no sample rows", async ({ page }) => {
    await gotoAndSettle(page, "/reviews?preview=empty")
    await expect(page.getByText("No reviews yet")).toBeVisible()
    await expect(page.getByRole("table")).toHaveCount(0)
    expect(await reviewLinks(page).count()).toBe(0)
  })

  test("an error shows a retry that keeps the filters, and nothing stale", async ({ page }) => {
    await gotoAndSettle(page, "/reviews?preview=error&rating=4")
    await expect(page.getByRole("alert").filter({ hasText: "We couldn't load reviews" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/reviews?rating=4")
    expect(await reviewLinks(page).count()).toBe(0)
  })

  test("a permission refusal is shown as an alert, without reviews", async ({ page }) => {
    await gotoAndSettle(page, "/reviews?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: "You don't have permission to see or answer reviews" })).toBeVisible()
    expect(await reviewLinks(page).count()).toBe(0)
    await gotoAndSettle(page, "/reviews/prv-rev-005?preview=forbidden")
    await expect(page.getByRole("alert").filter({ hasText: "You don't have permission to see or answer reviews" })).toBeVisible()
    await expect(page.getByRole("link", { name: "All reviews" })).toBeVisible()
    await expect(page.getByRole("textbox")).toHaveCount(0)
  })

  test("a slow source shows a loading state, then the reviews", async ({ page }) => {
    // Don't wait for the page to finish loading: the loading state is what's being checked.
    await page.goto("/reviews?preview=slow", { waitUntil: "commit" })
    await expect(page.getByRole("status", { name: "Loading reviews" })).toBeVisible()
    await expect(page.getByText("Showing 1–10 of 28 reviews")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("status", { name: "Loading reviews" })).toHaveCount(0)
  })

  test("a detail error shows a retry to the same review", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-005?preview=error")
    await expect(page.getByRole("alert").filter({ hasText: "We couldn't load reviews" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/reviews/prv-rev-005")
  })

  test("an unknown review id is not found, never another review", async ({ page }) => {
    for (const path of ["/reviews/prv-rev-999", "/reviews/not-a-review", "/reviews/prv-rev-005%20"]) {
      await gotoAndSettle(page, path)
      await expect(page.getByRole("heading", { level: 1, name: "Review not found" })).toBeVisible()
      await expect(page.getByRole("link", { name: "Back to reviews" })).toHaveAttribute("href", "/reviews")
      await expect(page.getByRole("textbox")).toHaveCount(0)
    }
  })
})

test.describe("detail", () => {
  test("shows the rating, text, reviewer, date and an order link for a linked review", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-001")
    await expect(page.getByRole("note").filter({ hasText: PREVIEW_LABEL })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Review by Aarav K." })).toBeVisible()
    await expect(page.getByText("Fresh and well packed. The dosa was still crisp when it arrived.")).toBeVisible()
    await expect(stars(page, /^5 out of 5 stars$/).first()).toBeVisible()
    await expect(page.locator("main time").first()).toBeVisible()
    const orderLink = page.getByRole("link", { name: "Order PRV-1016" })
    await expect(orderLink).toHaveAttribute("href", "/orders/prv-1016")
    await orderLink.click()
    await expect(page.getByRole("heading", { level: 1, name: /order prv-1016/i })).toBeVisible()
  })

  test("handles a rating-only review, a review without an order, and one without a name", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-003")
    await expect(page.getByRole("heading", { level: 1, name: "Review by Rohan P." })).toBeVisible()
    await expect(page.getByText("Rating only, no written review")).toBeVisible()
    await expect(page.getByText("Not linked to an order")).toBeVisible()
    await expect(page.getByRole("link", { name: /^Order / })).toHaveCount(0)

    await gotoAndSettle(page, "/reviews/prv-rev-008")
    await expect(page.getByRole("heading", { level: 1, name: "Review by a customer" })).toBeVisible()
    await expect(page.getByText("Name not shared")).toBeVisible()
    await expect(page.locator("main")).not.toContainText(/@|\+\d{2}|\d{10}/)
  })

  test("shows moderation and reply status only for reviews whose source supplied one", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-010")
    await expect(page.getByText("Under review by Foodi")).toBeVisible()

    await gotoAndSettle(page, "/reviews/prv-rev-007")
    await expect(page.getByText("Published", { exact: true })).toBeVisible()
    await expect(page.getByText(/Visible to customers/)).toBeVisible()
    await gotoAndSettle(page, "/reviews/prv-rev-011")
    await expect(page.getByText(/Waiting for approval/)).toBeVisible()

    // Replied, with no status from the source: nothing about visibility or approval.
    await gotoAndSettle(page, "/reviews/prv-rev-002")
    await expect(page.getByText("Thanks for the feedback, Meera. We're working on our delivery times.")).toBeVisible()
    await expect(page.locator("main")).not.toContainText(/visible to customers|waiting for approval|not published|under review|hidden from customers/i)
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /send reply|edit|delete/i })).toHaveCount(0)

    // No status at all on a plain review.
    await gotoAndSettle(page, "/reviews/prv-rev-005")
    await expect(page.locator("main")).not.toContainText(/Under review|Hidden from customers|Visible to customers|Waiting for approval/)
  })

  test("shows an existing report as a fact, with no second report control", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-017")
    await expect(page.getByText(/You reported this review/)).toBeVisible()
    await expect(page.getByText("Reason: Spam or a fake review")).toBeVisible()
    await expect(page.getByText(/isn't a moderation decision/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Report abuse" })).toHaveCount(0)
    // Reported reviews stay in the list.
    await gotoAndSettle(page, "/reviews?page=2")
    await expect(page.locator('main a[href^="/reviews/prv-rev-017"]').filter({ visible: true })).toHaveCount(1)
  })
})

test.describe("reply", () => {
  test("validates, records a simulated reply once, and offers no edit, delete or second reply", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-005")
    const box = page.getByRole("textbox", { name: "Write a reply" })
    await expect(page.getByText("1,000 of 1,000 characters left")).toBeVisible()
    await expect(page.getByText("A reply can't be edited or deleted after you send it.")).toBeVisible()

    await page.getByRole("button", { name: "Send reply" }).click()
    await expect(box).toHaveAttribute("aria-invalid", "true")
    await expect(box).toHaveAccessibleDescription(/Write a reply before sending it\./)

    await box.fill("a".repeat(1001))
    await expect(page.getByText("1 character over the 1,000 limit")).toBeVisible()
    await page.getByRole("button", { name: "Send reply" }).click()
    await expect(box).toHaveAccessibleDescription(/Keep your reply to 1,000 characters or fewer\. It is 1 over\./)

    await box.fill("b".repeat(1000))
    await expect(page.getByText("0 of 1,000 characters left")).toBeVisible()
    await page.getByRole("button", { name: "Send reply" }).click()

    await expectPreviewToast(page, /Reply submitted/)
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /send reply|edit|delete/i })).toHaveCount(0)
    await expect(page.getByText("b".repeat(1000))).toBeVisible()
    // Focus moves to the reply instead of being lost, and nothing claims it is visible to customers.
    await expect(page.getByRole("heading", { name: "Your reply" })).toBeFocused()
    await expect(page.locator("main")).not.toContainText(/visible to customers|published|approved/i)
    await expect(page.getByText("Replied", { exact: true }).first()).toBeVisible()

    // It was recorded: it survives a reload and shows in the list.
    await page.reload()
    await expect(page.getByText("b".repeat(1000))).toBeVisible()
    await gotoAndSettle(page, "/reviews?replied=replied")
    await expect(page.getByText("Showing 1–9 of 9 reviews")).toBeVisible()
  })

  test("a failed request is recoverable, shows no success, and the retry reuses the idempotency key", async ({ context }) => {
    const { page, finish } = await newPageForAbortedRequests(context)
    await gotoAndSettle(page, "/reviews/prv-rev-008")
    const bodies = await failActionRequests(page, "/reviews/prv-rev-008", 1)
    const box = page.getByRole("textbox", { name: "Write a reply" })
    await box.fill("Thank you, we're glad you liked it.")
    await page.getByRole("button", { name: "Send reply" }).click()

    await expect(page.getByRole("alert").filter({ hasText: REQUEST_FAILED })).toBeVisible()
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Reply submitted/ })).toHaveCount(0)
    await expect(box).toHaveValue("Thank you, we're glad you liked it.")
    await expect(page.getByRole("button", { name: "Send reply" })).toBeEnabled()

    await page.getByRole("button", { name: "Send reply" }).click()
    await expectPreviewToast(page, /Reply submitted/)
    await expect(page.getByText("Thank you, we're glad you liked it.")).toBeVisible()
    expect(bodies).toHaveLength(1)
    expect(idempotencyKeyIn(bodies[0])).toBeTruthy()
    await page.unroute("**/reviews/prv-rev-008")

    // Exactly one reply was applied.
    await gotoAndSettle(page, "/reviews?replied=replied")
    await expect(page.getByText("Showing 1–9 of 9 reviews")).toBeVisible()
    await finish()
  })

  test("a refusal as for someone who isn't the owner shows the permission message and records nothing", async ({ page }) => {
    await gotoAndSettle(page, "/reviews")
    await page.getByRole("switch", { name: /Refuse replies and reports/ }).click()
    await expectPreviewToast(page, /Replies and reports will be refused/)

    await gotoAndSettle(page, "/reviews/prv-rev-020")
    await page.getByRole("textbox", { name: "Write a reply" }).fill("Thank you!")
    await page.getByRole("button", { name: "Send reply" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "You don't have permission to do this." })).toBeVisible()
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Reply submitted/ })).toHaveCount(0)
    await expect(page.getByRole("textbox", { name: "Write a reply" })).toHaveValue("Thank you!")

    await page.getByRole("button", { name: "Report abuse" }).click()
    const dialog = page.getByRole("alertdialog", { name: "Report this review?" })
    await dialog.getByRole("radio", { name: "Spam or a fake review" }).check()
    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expect(dialog.getByRole("alert")).toContainText("You don't have permission to do this.")
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Report submitted/ })).toHaveCount(0)
    await dialog.getByRole("button", { name: "Cancel" }).click()

    await page.reload()
    await expect(page.getByRole("textbox", { name: "Write a reply" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Report abuse" })).toBeVisible()
  })

  test("can be written and sent from the keyboard alone", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-013")
    await page.getByRole("textbox", { name: "Write a reply" }).focus()
    await page.keyboard.type("Thanks for the rating, Tara!")
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "Send reply" })).toBeFocused()
    await page.keyboard.press("Enter")
    await expectPreviewToast(page, /Reply submitted/)
    await expect(page.getByText("Thanks for the rating, Tara!")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Your reply" })).toBeFocused()
  })

  test("resetting the sample reviews discards a simulated reply", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-005")
    await page.getByRole("textbox", { name: "Write a reply" }).fill("Thanks!")
    await page.getByRole("button", { name: "Send reply" }).click()
    await expectPreviewToast(page, /Reply submitted/)
    await expect(page.getByRole("textbox")).toHaveCount(0)

    await page.getByRole("button", { name: "Reset sample reviews" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(page.getByRole("textbox", { name: "Write a reply" })).toBeVisible()
  })
})

test.describe("report abuse", () => {
  const dialogOf = (page: Page) => page.getByRole("alertdialog", { name: "Report this review?" })

  test("needs a reason, then submits a simulated report that leaves the review visible and unchanged", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-009")
    await page.getByRole("button", { name: "Report abuse" }).click()
    const dialog = dialogOf(page)
    await expect(dialog).toContainText("It doesn't hide or remove the review")

    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expect(dialog.getByText("Choose a reason.")).toBeVisible()

    await dialog.getByRole("radio", { name: "Offensive or abusive language" }).check()
    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expectPreviewToast(page, /Report submitted/)
    await expect(dialog).toHaveCount(0)

    await expect(page.getByText(/You reported this review/)).toBeVisible()
    await expect(page.getByText("Reason: Offensive or abusive language")).toBeVisible()
    await expect(page.getByText(/isn't a moderation decision/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Report abuse" })).toHaveCount(0)
    // Nothing claims the review was removed, hidden, investigated or ruled abusive; its text and status are unchanged.
    await expect(page.locator("main")).not.toContainText(/was removed|has been removed|was hidden|investigat|ruled|Hidden from customers|Under review/i)
    await expect(page.getByText("Great service for a dine-in meal.")).toBeVisible()
    // Focus lands on the report details instead of being lost.
    await expect(page.locator(":focus")).toContainText("You reported this review")

    // Still in the list, now marked as reported by this restaurant.
    await gotoAndSettle(page, "/reviews")
    await expect(page.getByText("Showing 1–10 of 28 reviews")).toBeVisible()
    await expect(page.locator('main a[href^="/reviews/prv-rev-009"]').filter({ visible: true })).toHaveCount(1)
    await expect(page.getByText("You reported this").filter({ visible: true })).toHaveCount(1)
  })

  test("Other needs a note", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-012")
    await page.getByRole("button", { name: "Report abuse" }).click()
    const dialog = dialogOf(page)
    await dialog.getByRole("radio", { name: "Other" }).check()
    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expect(dialog.getByText("Add a short explanation for this reason.")).toBeVisible()
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Report submitted/ })).toHaveCount(0)

    await dialog.getByRole("textbox").fill("   ")
    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expect(dialog.getByText("Add a short explanation for this reason.")).toBeVisible()

    await dialog.getByRole("textbox").fill("Posted by a competitor")
    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expectPreviewToast(page, /Report submitted/)
    await expect(page.getByText("Reason: Other (Posted by a competitor)")).toBeVisible()
  })

  test("a failed request keeps the dialog open with an alert, shows no success, and the retry reuses the key", async ({ context }) => {
    const { page, finish } = await newPageForAbortedRequests(context)
    await gotoAndSettle(page, "/reviews/prv-rev-016")
    const bodies = await failActionRequests(page, "/reviews/prv-rev-016", 1)
    await page.getByRole("button", { name: "Report abuse" }).click()
    const dialog = dialogOf(page)
    await dialog.getByRole("radio", { name: "Contains personal information" }).check()
    await dialog.getByRole("button", { name: "Submit report" }).click()

    await expect(dialog.getByRole("alert")).toContainText(REQUEST_FAILED)
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Report submitted/ })).toHaveCount(0)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("radio", { name: "Contains personal information" })).toBeChecked()

    await dialog.getByRole("button", { name: "Submit report" }).click()
    await expectPreviewToast(page, /Report submitted/)
    await expect(dialog).toHaveCount(0)
    expect(bodies).toHaveLength(1)
    expect(idempotencyKeyIn(bodies[0])).toBeTruthy()
    await page.unroute("**/reviews/prv-rev-016")
    await finish()
  })

  test("is operable from the keyboard, with focus returning where it started", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-024")
    const button = page.getByRole("button", { name: "Report abuse" })
    await button.focus()
    await page.keyboard.press("Enter")
    const dialog = dialogOf(page)
    await expect(dialog).toBeVisible()
    // Focus is inside the dialog, which the page behind can't take back.
    await expect(dialog.locator(":focus")).toHaveCount(1)

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(button).toBeFocused()

    await page.keyboard.press("Enter")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("radio", { name: "Not about this restaurant" }).focus()
    await page.keyboard.press("Space")
    await expect(dialog.getByRole("radio", { name: "Not about this restaurant" })).toBeChecked()
    await dialog.getByRole("button", { name: "Submit report" }).focus()
    await page.keyboard.press("Enter")
    await expectPreviewToast(page, /Report submitted/)
    await expect(page.locator(":focus")).toContainText("You reported this review")
  })

  test("Cancel closes it without sending a report, and focus returns to the button", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-024")
    await page.getByRole("button", { name: "Report abuse" }).click()
    await dialogOf(page).getByRole("radio", { name: "Spam or a fake review" }).check()
    await dialogOf(page).getByRole("button", { name: "Cancel" }).click()
    await expect(dialogOf(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Report abuse" })).toBeFocused()
    await page.reload()
    await expect(page.getByRole("button", { name: "Report abuse" })).toBeVisible()
    await page.getByRole("button", { name: "Report abuse" }).click()
    // A fresh dialog starts with nothing chosen.
    await expect(dialogOf(page).getByRole("radio", { checked: true })).toHaveCount(0)
  })
})

test.describe("keyboard and accessibility", () => {
  test("the filters are reachable and usable from the keyboard", async ({ page }) => {
    await gotoAndSettle(page, "/reviews")
    const link = page.getByRole("navigation", { name: "Filter reviews by rating" }).getByRole("link", { name: "4 stars" })
    await link.focus()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/reviews\?rating=4$/)
    await page.getByRole("navigation", { name: "Filter reviews by reply status" }).getByRole("link", { name: "Replied", exact: true }).focus()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/reviews\?rating=4&replied=replied$/)
  })

  test("controls have accessible names", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-005")
    await expect(page.getByRole("textbox", { name: "Write a reply" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Send reply" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Report abuse" })).toBeVisible()
    await expect(page.getByRole("switch", { name: /Refuse replies and reports/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Reset sample reviews" })).toBeVisible()
    await expect(page.getByRole("img", { name: "5 out of 5 stars" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "All reviews" })).toBeVisible()
  })

  // One test per width, so each stays well inside the test timeout (axe on every page is slow).
  // Interactive states are covered by the dialog test and by the hovered-Button test below.
  for (const width of [390, 820, 1440]) {
    test(`lists and details have no overflow or serious accessibility issues at ${width} px`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width, height: 900 })
      for (const path of ["/reviews", "/reviews?rating=5&replied=unreplied&page=1", "/reviews?rating=2&replied=replied", "/reviews/prv-rev-001", "/reviews/prv-rev-007", "/reviews/prv-rev-017", "/reviews?preview=error", "/reviews?preview=empty"]) {
        await gotoAndSettle(page, path)
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
        await expectNoHorizontalOverflow(page)
        await expectNoSeriousA11yViolations(page)
      }
    })

    test(`the open report dialog has no overflow or serious accessibility issues at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await gotoAndSettle(page, "/reviews/prv-rev-005")
      await page.getByRole("button", { name: "Report abuse" }).click()
      await page.getByRole("alertdialog").getByRole("radio", { name: "Other" }).check()
      await page.getByRole("alertdialog").getByRole("button", { name: "Submit report" }).click()
      await expect(page.getByRole("alertdialog").getByText("Add a short explanation for this reason.")).toBeVisible()
      // The pointer is still on the default "Submit report" Button, so this also checks its hover state.
      await expectNoHorizontalOverflow(page)
      await expectNoSeriousA11yViolations(page)
    })
  }

  // The shared default Button once measured 4.27:1 while hovered (bg-primary/90). The design system's
  // darker hover token fixes that, so this is now an ordinary regression test: a hovered default Button
  // must have no serious accessibility findings. (It replaces a tripwire that only passed while the bug existed.)
  test("a hovered default Button keeps its text contrast", async ({ page }) => {
    await gotoAndSettle(page, "/reviews/prv-rev-005")
    const send = page.getByRole("button", { name: "Send reply" })
    await send.hover()
    // The hover colour is a short CSS transition; every frame between the two shades is above 4.5:1.
    await expect(send).toHaveCSS("background-color", "rgb(184, 51, 6)")
    await expectNoSeriousA11yViolations(page)
  })
})
