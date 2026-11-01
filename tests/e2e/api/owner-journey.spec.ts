import { expect, test, type Page } from "@playwright/test"

import { expectNoHorizontalOverflow, expectNoSeriousA11yViolations } from "../helpers"

// Real API, real database (foodi_e2e), no mocks. Owners come from server/tests/e2e/seed-website.ts.
const PASSWORD = "Site-password-123"
const APPROVED_OWNER = "site-owner@test.example"
const PENDING_OWNER = "site-pending@test.example"

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in to dashboard" }).click()
}

async function signIn(page: Page, email: string) {
  await page.goto("/login")
  await submitLogin(page, email, PASSWORD)
  await expect(page).not.toHaveURL(/\/login/)
}

test.describe("login page", () => {
  test("is accessible, has a title and does not overflow", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible()
    await expect(page).toHaveTitle(/.+/)
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
  })

  test("asks for an email and a password before calling the API", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: "Sign in to dashboard" }).click()
    await expect(page.getByText("Enter your email address.")).toBeVisible()
    await expect(page.getByLabel("Email address")).toBeFocused()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel("Email address").fill("not-an-email")
    await page.getByLabel("Password", { exact: true }).fill("x")
    await page.getByRole("button", { name: "Sign in to dashboard" }).click()
    await expect(page.getByText(/valid email address/i)).toBeVisible()
  })

  test("shows one generic error for a wrong password and for an unknown email", async ({ page }) => {
    await page.goto("/login")
    await submitLogin(page, APPROVED_OWNER, "definitely-wrong-password")
    const alert = page.getByRole("alert")
    await expect(alert).toContainText("Invalid email or password")
    await expect(page).toHaveURL(/\/login/)

    await submitLogin(page, "nobody@test.example", PASSWORD)
    await expect(alert).toContainText("Invalid email or password")
  })
})

test.describe("signed-out access", () => {
  for (const path of ["/dashboard", "/orders", "/menu", "/restaurants", "/wallet"]) {
    test(`${path} sends an anonymous visitor to the login page`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

test.describe("restaurant owner", () => {
  test("signs in, keeps the session across a reload and signs out", async ({ page }) => {
    await signIn(page, APPROVED_OWNER)
    await expect(page.getByText("Site Kitchen Approved").first()).toBeVisible()

    await page.reload()
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText("Site Kitchen Approved").first()).toBeVisible()

    await page.getByRole("button", { name: "Account menu" }).click()
    await page.getByRole("menuitem", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("an owner whose restaurant is still waiting for approval can sign in but is not given the dashboard", async ({ page }) => {
    await signIn(page, PENDING_OWNER)
    await expect(page.getByText("Site Kitchen Pending").first()).toBeVisible()
    await page.goto("/dashboard")
    // Operational pages need an approved restaurant: the owner is sent to My restaurants.
    await expect(page).toHaveURL(/\/restaurants/)
  })

  test("the signed-in pages do not overflow or break accessibility rules", async ({ page }) => {
    await signIn(page, APPROVED_OWNER)
    await page.goto("/restaurants")
    await expect(page.getByText("Site Kitchen Approved").first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
  })
})
