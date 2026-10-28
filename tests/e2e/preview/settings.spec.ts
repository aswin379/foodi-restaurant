import { expect, test, type Page } from "@playwright/test"

import { expectNoConsoleErrors, expectNoHorizontalOverflow, expectNoSeriousA11yViolations, gotoAndSettle } from "../helpers"

// Restaurant profile and order settings (B4a) against preview data. They
// change the shared preview settings record, so they run one at a time and
// each starts from the reset sample settings. Only the settings record is
// written; hours and menu are only read, to show they're unchanged.
test.describe.configure({ mode: "serial" })

const PREVIEW_LABEL = "Preview only, not saved to Foodi"
// A 1×1 transparent PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

/** Next's default Server Action body limit; no profile save may exceed it. */
const REQUEST_LIMIT = 1024 * 1024

/**
 * A JPEG made in the browser. "photo" is a detailed, photo-like picture;
 * "noise" is random pixels, the worst case for compression.
 */
async function makeJpeg(page: Page, width: number, height: number, kind: "photo" | "noise"): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([width, height, kind]) => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")!
      const image = context.createImageData(width, height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          const grain = (Math.random() - 0.5) * 40
          image.data[i] = kind === "noise" ? Math.random() * 255 : (x / width) * 200 + 30 + grain + 30 * Math.sin(y / 23)
          image.data[i + 1] = kind === "noise" ? Math.random() * 255 : (y / height) * 180 + 40 + grain + 25 * Math.cos(x / 31)
          image.data[i + 2] = kind === "noise" ? Math.random() * 255 : 120 + grain + 60 * Math.sin((x + y) / 47)
          image.data[i + 3] = 255
        }
      }
      context.putImageData(image, 0, 0)
      return canvas.toDataURL("image/jpeg", 0.92).split(",")[1]
    },
    [width, height, kind] as const
  )
  return Buffer.from(base64, "base64")
}

/** Sizes of the Server Action requests a page sends (they carry a Next-Action header). */
function recordActionRequests(page: Page) {
  const sizes: number[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) sizes.push(request.postDataBuffer()?.length ?? 0)
  })
  return sizes
}

async function resetSampleSettings(page: Page) {
  await gotoAndSettle(page, "/settings/profile")
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

test("profile: validation links, read-only region, and a labelled preview save", async ({ page }) => {
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("note").filter({ hasText: PREVIEW_LABEL })).toBeVisible()
  // D7: shown, not editable.
  await expect(page.getByText("Asia/Kolkata", { exact: true })).toBeVisible()
  await expect(page.getByRole("textbox", { name: /time zone|currency|language/i })).toHaveCount(0)

  await page.getByRole("textbox", { name: /Restaurant name/ }).fill("")
  await page.getByRole("textbox", { name: /^Phone/ }).fill("123")
  await page.getByRole("textbox", { name: /^Latitude/ }).fill("95")
  await page.getByRole("button", { name: "Save profile" }).click()
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toBeFocused()
  await expect(summary).toContainText("Enter the restaurant name.")
  await expect(summary).toContainText("7 to 15 digits")
  await expect(summary).toContainText("between -90 and 90")
  await summary.getByRole("link", { name: /between -90 and 90/ }).click()
  await expect(page.getByRole("textbox", { name: /^Latitude/ })).toBeFocused()

  await page.getByRole("textbox", { name: /Restaurant name/ }).fill("Spice Route")
  await page.getByRole("textbox", { name: /^Phone/ }).fill("+91 80 1234 5678")
  await page.getByRole("textbox", { name: /^Latitude/ }).fill("12.9352")
  await page.getByRole("textbox", { name: /^Longitude/ }).fill("77.6245")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expectPreviewToast(page, /Restaurant profile updated/)
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("textbox", { name: /Restaurant name/ })).toHaveValue("Spice Route")
  await expect(page.getByRole("textbox", { name: /^Longitude/ })).toHaveValue("77.6245")
})

test("profile: a stale save is refused and nothing is overwritten", async ({ page, context }) => {
  await gotoAndSettle(page, "/settings/profile")

  // Someone else saves the profile after this page loaded.
  const other = await context.newPage()
  await other.goto("/settings/profile")
  await other.waitForLoadState("networkidle")
  await other.getByRole("textbox", { name: /Restaurant name/ }).fill("Changed elsewhere")
  await other.getByRole("button", { name: "Save profile" }).click()
  await expect(other.locator('[data-slot="toast"]').filter({ hasText: /Restaurant profile updated/ }).last()).toBeVisible()
  await other.close()

  await page.getByRole("textbox", { name: /Restaurant name/ }).fill("My change")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.getByRole("alert").filter({ hasText: /changed since you opened this page/ })).toBeVisible()
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("textbox", { name: /Restaurant name/ })).toHaveValue("Changed elsewhere")
})

test("profile: logo and cover images are checked for type and size", async ({ page }) => {
  await gotoAndSettle(page, "/settings/profile")
  const logoInput = page.locator("#settings-logo")
  await logoInput.setInputFiles({ name: "logo.gif", mimeType: "image/gif", buffer: TINY_PNG })
  await expect(page.getByText("Choose a JPG, PNG or WebP image.")).toBeVisible()
  await logoInput.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
  await expect(page.getByText("Choose an image of 2 MB or less.")).toBeVisible()

  await logoInput.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG })
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toBeVisible()
  await page.locator("#settings-cover").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: TINY_PNG })
  await expect(page.getByRole("img", { name: "Restaurant cover image" })).toBeVisible()
  await page.getByRole("button", { name: "Save profile" }).click()
  await expectPreviewToast(page, /Restaurant profile updated/)
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toBeVisible()
  await page.getByRole("button", { name: "Remove logo image" }).click()
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toHaveCount(0)
  await expect(page.getByRole("img", { name: "Restaurant cover image" })).toBeVisible()
  await page.getByRole("button", { name: "Remove cover image" }).click()
  await expect(page.getByRole("img", { name: "Restaurant cover image" })).toHaveCount(0)
  await page.getByRole("button", { name: "Save profile" }).click()
  await expectPreviewToast(page, /Restaurant profile updated/)
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("img", { name: /Restaurant (logo|cover image)/ })).toHaveCount(0)
})

test("profile: realistic logo and cover photos save together in one request under the limit", async ({ page }) => {
  await gotoAndSettle(page, "/settings/profile")
  const sizes = recordActionRequests(page)
  const logo = await makeJpeg(page, 1200, 1200, "photo")
  const cover = await makeJpeg(page, 2400, 1200, "photo")
  expect(logo.length).toBeGreaterThan(200_000)
  expect(cover.length).toBeGreaterThan(400_000)
  await page.locator("#settings-logo").setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: logo })
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toBeVisible()
  await page.locator("#settings-cover").setInputFiles({ name: "cover.jpg", mimeType: "image/jpeg", buffer: cover })
  await expect(page.getByRole("img", { name: "Restaurant cover image" })).toBeVisible()
  await page.getByRole("button", { name: "Save profile" }).click()
  await expectPreviewToast(page, /Restaurant profile updated/)
  expect(sizes.length).toBeGreaterThan(0)
  expect(Math.max(...sizes)).toBeLessThan(REQUEST_LIMIT)
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toBeVisible()
  await expect(page.getByRole("img", { name: "Restaurant cover image" })).toBeVisible()
})

test("profile: worst-case images never produce an oversized request or a crash", async ({ page }) => {
  await gotoAndSettle(page, "/settings/profile")
  const sizes = recordActionRequests(page)
  // Random pixels compress worst; before the budgets these two made a 1.5 MB request that crashed the page.
  await page.locator("#settings-logo").setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, 800, 800, "noise") })
  await page.locator("#settings-cover").setInputFiles({ name: "cover.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, 1600, 900, "noise") })
  // Each picker either fits its image to its budget (shown) or says clearly that it can't.
  for (const [name, button] of [["Restaurant logo", "logo image"], ["Restaurant cover image", "cover image"]] as const) {
    await expect(page.getByRole("img", { name }).or(page.getByText("still too large after compression")).first()).toBeVisible()
    await expect(page.getByRole("button", { name: new RegExp(`Choose (another )?${button}`) })).toBeVisible()
  }
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(
    page.locator('[data-slot="toast"]').filter({ hasText: /Restaurant profile updated/ }).or(page.getByRole("alert").filter({ hasText: /nothing was saved|too large/ })).first()
  ).toBeVisible()
  expect(Math.max(0, ...sizes)).toBeLessThan(REQUEST_LIMIT)
})

test("profile: a rejected save request shows a recoverable error and claims nothing was saved", async ({ context }) => {
  // Its own page: Chromium logs the deliberately failed request as a console error, which is checked here instead.
  const page = await context.newPage()
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()))
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto("/settings/profile")
  await page.waitForLoadState("networkidle")
  await page.route("**/settings/profile", (route) =>
    route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort("failed") : route.continue()
  )
  await page.getByRole("textbox", { name: /Restaurant name/ }).fill("Spice Route")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "nothing was saved" })).toBeVisible()
  await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Restaurant profile updated/ })).toHaveCount(0)

  // Recover: the same change goes through once the request can be sent.
  await page.unroute("**/settings/profile")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Restaurant profile updated/ }).last()).toContainText(PREVIEW_LABEL)
  await page.goto("/settings/profile")
  await page.waitForLoadState("networkidle")
  await expect(page.getByRole("textbox", { name: /Restaurant name/ })).toHaveValue("Spice Route")
  expect(pageErrors).toEqual([])
  expect(consoleErrors.every((text) => /Failed to load resource|ERR_FAILED/.test(text))).toBe(true)
  await page.close()
})

test("profile: a save refused for permission is announced, and nothing changes (D9)", async ({ page }) => {
  await gotoAndSettle(page, "/settings/profile")
  await page.getByRole("switch", { name: /Refuse saves, as for someone who isn.t the owner/ }).click()
  await expectPreviewToast(page, /Saves will be refused/)
  await page.getByRole("textbox", { name: /Restaurant name/ }).fill("Not allowed")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "You don't have permission to do this." })).toBeVisible()
  await expect(page.locator('[data-slot="toast"]').filter({ hasText: /Restaurant profile updated/ })).toHaveCount(0)
  await gotoAndSettle(page, "/settings/orders")
  await page.getByRole("switch", { name: "Require a pickup code" }).click()
  await page.getByRole("button", { name: "Save order settings" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "You don't have permission to do this." })).toBeVisible()
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("textbox", { name: /Restaurant name/ })).not.toHaveValue("Not allowed")
})

test("profile: keyboard order, image controls and error-summary links", async ({ page }) => {
  await gotoAndSettle(page, "/settings/profile")
  const name = page.getByRole("textbox", { name: /Restaurant name/ })
  await name.focus()
  // Walk the form with Tab and record what receives focus.
  const visited: string[] = []
  for (let step = 0; step < 30; step++) {
    visited.push(
      await page.evaluate(() => {
        const element = document.activeElement as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> }
        return (element.labels?.[0]?.textContent ?? element.textContent ?? "").replace(/(Required|Optional)$/, "").trim()
      })
    )
    if (visited.at(-1) === "Save profile") break
    await page.keyboard.press("Tab")
  }
  const order = ["Restaurant name", "Description", "Phone", "Email", "Address", "Address line 2", "City", "State or region", "Postal code", "Latitude", "Longitude", "Choose logo image", "Choose cover image", "Save profile"]
  expect(order.map((label) => visited.indexOf(label))).toEqual([...order.map((label) => visited.indexOf(label))].sort((a, b) => a - b))
  expect(order.every((label) => visited.includes(label))).toBe(true)

  // Choose and remove the logo without a mouse.
  await page.getByRole("button", { name: "Choose logo image" }).focus()
  const chooser = page.waitForEvent("filechooser")
  await page.keyboard.press("Enter")
  await (await chooser).setFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG })
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toBeVisible()
  await page.getByRole("button", { name: "Choose another logo image" }).focus()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "Remove logo image" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("img", { name: "Restaurant logo" })).toHaveCount(0)

  // The error summary takes focus, and its links move focus to the field.
  await name.fill("")
  await page.getByRole("button", { name: "Save profile" }).focus()
  await page.keyboard.press("Enter")
  const summary = page.getByRole("alert").filter({ hasText: "before saving" })
  await expect(summary).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(summary.getByRole("link", { name: "Enter the restaurant name." })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(name).toBeFocused()
})

test("settings pages at tablet width (820 px) have no overflow or serious accessibility issues", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  for (const path of ["/settings", "/settings/profile", "/settings/orders"]) {
    await gotoAndSettle(page, path)
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
  }
  // With both image previews showing.
  await gotoAndSettle(page, "/settings/profile")
  await page.locator("#settings-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG })
  await page.locator("#settings-cover").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: TINY_PNG })
  await expect(page.getByRole("img", { name: "Restaurant cover image" })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousA11yViolations(page)
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
  for (const path of ["/settings/profile?preview=forbidden", "/settings/orders?preview=forbidden"]) {
    await gotoAndSettle(page, path)
    await expect(page.getByRole("alert").filter({ hasText: "permission" })).toContainText(
      "You don't have permission to see or change restaurant settings"
    )
    await expect(page.getByRole("button", { name: /Save/ })).toHaveCount(0)
  }
})
