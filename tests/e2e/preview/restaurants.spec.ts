import { expect, test } from "@playwright/test"

import { expectNoSeriousA11yViolations, gotoAndSettle, mockOwnerSession } from "../helpers"

// My Restaurants and Add Restaurant, with the API mocked (the preview server has none).

test.describe("my restaurants", () => {
  test("an owner with one approved and one pending restaurant chooses, and the pending one is not operational", async ({ page }) => {
    await mockOwnerSession(page, [
      { id: 1, name: "Preview Kitchen", status: "APPROVED", isOperational: true },
      { id: 2, name: "Second Kitchen", status: "SUBMITTED", isOperational: false },
    ])
    await gotoAndSettle(page, "/restaurants")
    await expect(page.getByRole("heading", { name: "My restaurants" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Open dashboard" })).toHaveCount(1)
    await expect(page.getByText("Submitted · awaiting review")).toBeVisible()
    await expect(page.getByRole("link", { name: "Add restaurant" })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })

  test("an owner with only pending restaurants sees the pending state and cannot open the dashboard", async ({ page }) => {
    await mockOwnerSession(page, [{ id: 2, name: "Second Kitchen", status: "UNDER_REVIEW", isOperational: false }])
    await gotoAndSettle(page, "/restaurants")
    await expect(page.getByText(/none of your restaurants is approved yet/i)).toBeVisible()
    await expect(page.getByRole("button", { name: "Open dashboard" })).toHaveCount(0)
    await gotoAndSettle(page, "/dashboard")
    await expect(page).toHaveURL(/\/restaurants$/)
  })

  test("one approved restaurant goes straight to its dashboard after sign-in", async ({ page }) => {
    await gotoAndSettle(page, "/restaurants?auto=1")
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
