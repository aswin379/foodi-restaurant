import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

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
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}

export function expectNoConsoleErrors(page: Page) {
  expect(consoleErrors.get(page) ?? []).toEqual([])
}
