import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/** Fails on serious or critical WCAG 2.x A/AA violations (PRD §7: WCAG 2.2 AA). */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  const serious = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      detail: violation.nodes.map((node) => node.any.map((check) => check.message).join(" ")),
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }))
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

export type MockRestaurant = {
  id: number
  name: string
  status: string
  isOperational: boolean
  subscriptionStatus?: string | null
}

const PREVIEW_RESTAURANT: MockRestaurant = {
  id: 1,
  name: "Preview Kitchen",
  status: "APPROVED",
  isOperational: true,
}

/**
 * Preview pages sit behind the owner sign-in, and the preview server has no API. This answers the two calls the
 * app makes on load (session restore and the restaurant list) so the dashboard opens as an owner of the given
 * restaurants. Call again with other restaurants to change what the page sees.
 */
export async function mockOwnerSession(page: Page, restaurants: MockRestaurant[] = [PREVIEW_RESTAURANT]) {
  // A spec's own mock must not be overridden by the default one gotoAndSettle would add (later routes win).
  signedInPages.add(page)
  const json = (data: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data }),
  })
  await page.route("**/api/v1/seller/auth/refresh", (route) =>
    route.fulfill(
      json({
        accessToken: "preview-token",
        accessTokenExpiresIn: 900,
        user: {
          id: 1,
          firstName: "Preview",
          lastName: "Owner",
          email: "owner@preview.test",
          restaurant: { id: restaurants[0]?.id ?? 1, name: restaurants[0]?.name ?? "" },
          restaurants: restaurants.map(({ id, name, status }) => ({ id, name, status })),
        },
      })
    )
  )
  await page.route("**/api/v1/seller/restaurants", (route) =>
    route.fulfill(
      json({
        restaurants: restaurants.map((r) => ({
          logoUrl: null,
          subscriptionStatus: null,
          subscriptionExpiresOn: null,
          ...r,
        })),
      })
    )
  )
}

const signedInPages = new WeakSet<Page>()

const consoleErrors = new WeakMap<Page, string[]>()

/**
 * Waits for streamed content (Suspense boundaries) to settle, and starts
 * recording console errors and uncaught exceptions for expectNoConsoleErrors.
 */
export async function gotoAndSettle(page: Page, path: string) {
  if (!consoleErrors.has(page)) {
    const errors: string[] = []
    consoleErrors.set(page, errors)
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))
  }
  // Preview specs run without an API, so they open the app as a signed-in owner (production specs do not).
  if (test.info().file.split("\\").join("/").includes("/e2e/preview/") && !signedInPages.has(page)) {
    signedInPages.add(page)
    await mockOwnerSession(page)
  }
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}

export function expectNoConsoleErrors(page: Page) {
  expect(consoleErrors.get(page) ?? []).toEqual([])
}
