import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// The preview-only /design-system showcase (redesign Gate 2). Read-only: it
// changes nothing and shows only sample content, so it can run beside the other
// preview specs, at desktop and mobile width.

/** Overlays fade and zoom in; axe must see the settled colours, not a half-transparent frame. */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        // Infinite animations (the skeleton's pulse) never finish; only the overlay's fade and zoom matter.
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    )
  )
}

async function expectCleanPage(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
  expectNoConsoleErrors(page)
}

test.describe("design system showcase", () => {
  test("renders every section accessibly, with no overflow or console errors", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible()
    await expect(page.getByRole("note").filter({ hasText: "Preview only, not saved to Foodi" })).toBeVisible()
    for (const section of ["Colour", "Contrast", "Typography", "Shape and elevation", "Buttons", "Badges and statuses", "Form controls", "Surfaces", "Overlays"]) {
      await expect(page.getByRole("heading", { level: 2, name: section })).toBeAttached()
    }
    await expectCleanPage(page)
  })

  test("shows every token with its HEX value, including the approved brand colours", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    const main = page.locator("main")
    for (const hex of ["#D63F08", "#F26A1B", "#9A8B82", "#B02F05", "#FBF7F4"]) {
      await expect(main.getByText(hex, { exact: true }).first()).toBeAttached()
    }
    // One swatch per token (54 tokens), none carrying text that could fail contrast itself.
    await expect(main.locator("#colour-heading").locator("xpath=ancestor::section").locator("li")).toHaveCount(54)
  })

  test("reports every contrast pairing as passing", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    const table = page.locator("#contrast-heading").locator("xpath=ancestor::section").getByRole("table")
    await expect(table.getByText("Pass", { exact: true }).first()).toBeAttached()
    await expect(table.getByText("Fail", { exact: true })).toHaveCount(0)
  })

  test("loads Plus Jakarta Sans for the interface and Geist Mono for codes", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    const families = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      mono: getComputedStyle(document.querySelector("code, .font-mono")!).fontFamily,
    }))
    expect(families.body).toMatch(/Plus[_ ]Jakarta[_ ]Sans/)
    expect(families.mono).toMatch(/Geist[_ ]Mono/)
    // The font really loaded, not just declared.
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].some((face) => /Plus Jakarta Sans/i.test(face.family) && face.status === "loaded")
    })
    expect(loaded).toBe(true)
  })

  test("uses one solid focus ring in the primary colour", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    const button = page.getByRole("button", { name: "Primary" }).first()
    await button.focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Shift+Tab")
    // The ring eases in with the button's colour transition, so wait for it to settle.
    await expect
      .poll(() =>
        button.evaluate((element) => {
          const style = getComputedStyle(element)
          return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor, offset: style.outlineOffset }
        })
      )
      .toEqual({ style: "solid", width: "2px", color: "rgb(214, 63, 8)", offset: "2px" })
  })

  test("renders buttons in the approved primary colour", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    const background = await page.getByRole("button", { name: "Primary" }).nth(1).evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(background).toBe("rgb(214, 63, 8)")
    const height = await page.getByRole("button", { name: "Primary" }).nth(1).evaluate((element) => element.getBoundingClientRect().height)
    expect(height).toBe(40)
  })

  test("opens and closes every overlay, with focus returning to its trigger", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    for (const [trigger, role] of [
      ["Open dialog", "dialog"],
      ["Open confirmation", "alertdialog"],
      ["Open side sheet", "dialog"],
    ] as const) {
      const button = page.getByRole("button", { name: trigger })
      await button.scrollIntoViewIfNeeded()
      await button.click()
      await expect(page.getByRole(role)).toBeVisible()
      await settleAnimations(page)
      await expectNoSeriousA11yViolations(page)
      await page.keyboard.press("Escape")
      await expect(page.getByRole(role)).toHaveCount(0)
      await expect(button).toBeFocused()
    }

    await page.getByRole("button", { name: "Open sample menu" }).click()
    await expect(page.getByRole("menuitem", { name: "First action" })).toBeVisible()
    await settleAnimations(page)
    await expectNoSeriousA11yViolations(page)
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Open popover" }).click()
    await expect(page.getByText("A popover uses a 12px radius")).toBeVisible()
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Hover or focus for a tooltip" }).focus()
    await expect(page.getByRole("tooltip").filter({ hasText: "Sample tooltip" })).toBeVisible()
    expectNoConsoleErrors(page)
  })

  test("shows toasts as notifications", async ({ page }) => {
    await gotoAndSettle(page, "/design-system")
    await page.getByRole("button", { name: "Show success toast" }).click()
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: "Sample notification" })).toBeVisible()
    await page.getByRole("button", { name: "Show error toast" }).click()
    await expect(page.locator('[data-slot="toast"]').filter({ hasText: "Sample error" })).toBeVisible()
  })

  test("is not in the navigation, and contains no real or financial data", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard")
    if (!(await page.getByRole("navigation", { name: "Restaurant admin" }).first().isVisible())) {
      await page.getByRole("button", { name: "Open navigation" }).click()
    }
    const nav = page.getByRole("navigation", { name: "Restaurant admin" }).filter({ visible: true })
    await expect(nav.getByRole("link", { name: /design/i })).toHaveCount(0)

    await gotoAndSettle(page, "/design-system")
    const text = (await page.locator("main").innerText()).toLowerCase()
    expect(text).not.toMatch(/@|phone|customer name|upi|account number|bank|gst|invoice/)
  })

  test("holds up at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await gotoAndSettle(page, "/design-system")
    await expectCleanPage(page)
  })
})
