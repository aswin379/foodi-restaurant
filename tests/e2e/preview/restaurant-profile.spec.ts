import { expect, test, type Page, type Route } from "@playwright/test"

import { expectNoConsoleErrors, expectNoSeriousA11yViolations, gotoAndSettle, mockOwnerSession } from "../helpers"

// The restaurant profile, with the API mocked (the preview server has none). The mock answers
// by the X-Seller-Id header, as the real API does, so these specs also prove the page asks for the right restaurant.

const RESTAURANTS = [
  { id: 1, name: "Alpha Kitchen", status: "APPROVED", isOperational: true },
  { id: 2, name: "Beta Bistro", status: "APPROVED", isOperational: true },
  { id: 3, name: "Gamma Grill", status: "UNDER_REVIEW", isOperational: false },
]

const OPTIONS = {
  sellerTypes: [
    { id: 1, name: "Restaurant" },
    { id: 2, name: "Cloud kitchen" },
  ],
  cuisines: [
    { id: 11, name: "Kerala" },
    { id: 12, name: "Seafood" },
    { id: 13, name: "Italian" },
  ],
  zones: [],
}

const SETTINGS = {
  foodSection: true,
  scheduleOrder: true,
  reviewsSection: true,
  posSystem: false,
  selfDeliverySystem: true,
  homeDelivery: true,
  takeAway: true,
  orderSubscriptionActive: false,
  instantOrder: true,
  customDateOrder: false,
  customerOrderDays: 0,
  halalTag: false,
  dineIn: false,
  roomService: false,
  dineInMinTime: 0,
  dineInMinTimeUnit: "min",
  canEditOrder: false,
  menuType: "both",
  minimumOrder: 0,
}

function profile(id: number, name: string, address: string, zone: string, cuisines: number[]) {
  return {
    id,
    status: "APPROVED",
    name,
    description: `About ${name}`,
    sellerTypeId: 1,
    sellerType: "Restaurant",
    cuisines: OPTIONS.cuisines.filter((c) => cuisines.includes(c.id)),
    tags: ["Family"],
    address: { address, latitude: 10.5, longitude: 76.25, zone },
    delivery: { mode: "SELF", radiusKm: 7, fee: 25, freeDeliveryThreshold: null, codEnabled: true },
    prepTime: { min: 20, max: 40, unit: "min" },
    settings: { ...SETTINGS },
    // Dine-in is switched off for everyone by Foodi.
    gates: { scheduleOrder: true, homeDelivery: true, takeAway: true, instantOrder: true, dineIn: false, canEditOrder: true, orderSubscription: true },
    logoUrl: null,
    coverUrl: null,
    updatedAt: "2026-10-31T10:00:00.000Z",
  }
}

type Profile = Omit<ReturnType<typeof profile>, "logoUrl" | "coverUrl"> & { logoUrl: string | null; coverUrl: string | null }
type Seen = { method: string; path: string; sellerId: string | undefined; body: unknown; contentType: string | undefined }

// A 1x1 transparent PNG the mock "stores" for the uploaded logo.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

async function mockApi(page: Page) {
  const profiles: Record<number, Profile> = {
    1: profile(1, "Alpha Kitchen", "1 Alpha Road", "Alpha Zone", [11, 12]),
    2: profile(2, "Beta Bistro", "2 Beta Lane", "Beta Zone", [13]),
  }
  const seen: Seen[] = []
  const reply = (route: Route, status: number, data: unknown) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data }) })
  const record = (route: Route) => {
    const request = route.request()
    const body = request.method() === "PATCH" || request.method() === "POST" ? request.postDataJSON() : null
    seen.push({
      method: request.method(),
      path: new URL(request.url()).pathname.replace("/api/v1", ""),
      sellerId: request.headers()["x-seller-id"],
      body,
      contentType: request.headers()["content-type"],
    })
    return { request, body, found: profiles[Number(request.headers()["x-seller-id"])] }
  }

  await page.route("**/api/v1/public/restaurant-applications/options", (route) => reply(route, 200, OPTIONS))

  await page.route(/\/api\/v1\/seller\/restaurant\/profile(\/.*)?$/, async (route) => {
    const { request, body, found } = record(route)
    if (!found) return reply(route, 404, null)
    const section = new URL(request.url()).pathname.split("/profile")[1] ?? ""
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mock reads whichever section body arrives
    const data = body as Record<string, any>
    if (request.method() === "POST" && section === "/resolve-location") {
      return data["latitude"] > 50
        ? reply(route, 400, null)
        : reply(route, 200, { zoneId: 5, zoneName: "Checked Zone" })
    }
    if (request.method() === "PATCH") {
      if (section === "/business") {
        Object.assign(found, {
          name: data["name"],
          description: data["description"],
          sellerTypeId: data["sellerTypeId"],
          sellerType: OPTIONS.sellerTypes.find((t) => t.id === data["sellerTypeId"])?.name,
          cuisines: OPTIONS.cuisines.filter((c) => data["cuisineIds"].includes(c.id)),
          tags: data["tags"],
        })
      } else if (section === "/address") {
        found.address = { address: data["address"], latitude: data["latitude"], longitude: data["longitude"], zone: "Checked Zone" }
      } else if (section === "/delivery") {
        found.delivery = {
          mode: data["deliveryMode"],
          radiusKm: data["deliveryRadiusKm"],
          fee: data["deliveryFee"],
          freeDeliveryThreshold: data["freeDeliveryThreshold"] ?? null,
          codEnabled: data["codEnabled"],
        }
        found.prepTime = { min: data["prepTimeMin"], max: data["prepTimeMax"], unit: data["prepTimeUnit"] }
      } else if (section === "/settings") {
        Object.assign(found.settings, data)
      }
      found.updatedAt = new Date().toISOString()
    }
    if (section.startsWith("/files/")) {
      const key = section.endsWith("logo") ? "logoUrl" : "coverUrl"
      found[key] = request.method() === "PUT" ? PIXEL : null
    }
    return reply(route, 200, { profile: found })
  })

  return seen
}

async function open(page: Page, activeId: number) {
  await mockOwnerSession(page, RESTAURANTS)
  const seen = await mockApi(page)
  await page.addInitScript((id) => window.localStorage.setItem("foodi.activeRestaurant", String(id)), activeId)
  await gotoAndSettle(page, "/settings/profile")
  return seen
}

const form = (page: Page, name: string) => page.getByRole("form", { name })
const toast = (page: Page, text: string) => page.locator('[data-slot="toast"]').filter({ hasText: text }).last()
const saved = (seen: Seen[], path: string) => seen.find((r) => r.method === "PATCH" && r.path.endsWith(path))

test.afterEach(async ({ page }, testInfo) => {
  // The refused-request and out-of-zone tests make the browser log a 404/400 on purpose.
  if (!/refuses|checks the zone/.test(testInfo.title)) expectNoConsoleErrors(page)
})

test("an approved restaurant's real details appear in the profile forms", async ({ page }) => {
  const seen = await open(page, 1)
  await expect(page.getByRole("heading", { name: "Alpha Kitchen", level: 2 })).toBeVisible()

  const details = form(page, "Restaurant details")
  await expect(details.getByLabel("Restaurant name")).toHaveValue("Alpha Kitchen")
  await expect(details.getByLabel("Restaurant type")).toHaveValue("1")
  await expect(details.getByLabel("Description")).toHaveValue("About Alpha Kitchen")
  await expect(details.getByRole("checkbox", { name: "Kerala" })).toBeChecked()
  await expect(details.getByRole("checkbox", { name: "Seafood" })).toBeChecked()
  await expect(details.getByRole("checkbox", { name: "Italian" })).not.toBeChecked()
  await expect(details.getByLabel("Tags")).toHaveValue("Family")

  const location = form(page, "Address and location")
  await expect(location.getByLabel("Address")).toHaveValue("1 Alpha Road")
  await expect(location.getByLabel("Latitude")).toHaveValue("10.5")
  await expect(location.getByLabel("Longitude")).toHaveValue("76.25")
  await expect(location).toContainText("Current zone: Alpha Zone")

  const delivery = form(page, "Delivery and timing")
  await expect(delivery.getByLabel("Delivery mode")).toHaveValue("SELF")
  await expect(delivery.getByLabel("Delivery radius (km)")).toHaveValue("7")
  await expect(delivery.getByLabel("Minimum prep time")).toHaveValue("20")
  await expect(delivery.getByLabel("Maximum prep time")).toHaveValue("40")

  await expect(form(page, "Order options").getByRole("switch", { name: "Takeaway" })).toBeChecked()
  expect(seen.find((r) => r.path === "/seller/restaurant/profile")?.sellerId).toBe("1")
  await expectNoSeriousA11yViolations(page)
})

test("switching restaurants shows the other restaurant's profile", async ({ page }) => {
  await open(page, 1)
  await expect(page.getByRole("heading", { name: "Alpha Kitchen", level: 2 })).toBeVisible()

  await page.getByRole("button", { name: /Alpha Kitchen.*Switch restaurant/ }).click()
  await page.getByRole("menuitem", { name: "Beta Bistro" }).click()

  await expect(page.getByRole("heading", { name: "Beta Bistro", level: 2 })).toBeVisible()
  await expect(form(page, "Restaurant details").getByLabel("Restaurant name")).toHaveValue("Beta Bistro")
  await expect(form(page, "Address and location").getByLabel("Address")).toHaveValue("2 Beta Lane")
  await expect(page.locator("main")).not.toContainText("1 Alpha Road")
})

test("the owner edits the restaurant details and they are saved for the selected restaurant", async ({ page }) => {
  const seen = await open(page, 2)
  const details = form(page, "Restaurant details")
  await details.getByLabel("Restaurant name").fill("Beta Bistro & Bar")
  await details.getByLabel("Restaurant type").selectOption("2")
  await details.getByRole("checkbox", { name: "Kerala" }).click()
  await details.getByLabel("Tags").fill("Family, Late night")
  await details.getByRole("button", { name: "Save changes" }).click()

  await expect(toast(page, "Restaurant details saved")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Beta Bistro & Bar", level: 2 })).toBeVisible()
  const request = saved(seen, "/business")
  expect(request?.sellerId).toBe("2")
  expect(request?.body).toEqual({
    sellerTypeId: 2,
    name: "Beta Bistro & Bar",
    description: "About Beta Bistro",
    cuisineIds: [13, 11],
    tags: ["Family", "Late night"],
  })
})

test("the owner changes the address, checks the zone and saves", async ({ page }) => {
  const seen = await open(page, 1)
  const location = form(page, "Address and location")
  await location.getByLabel("Address").fill("9 New Street")
  await location.getByLabel("Latitude").fill("11.25")
  await location.getByLabel("Longitude").fill("75.75")
  await location.getByRole("button", { name: "Check zone" }).click()
  await expect(location).toContainText("This pin is in Checked Zone.")
  await location.getByRole("button", { name: "Save changes" }).click()

  await expect(toast(page, "Address and location saved")).toBeVisible()
  expect(saved(seen, "/address")?.body).toEqual({ address: "9 New Street", latitude: 11.25, longitude: 75.75 })
  await expect(location).toContainText("Current zone: Checked Zone")

  // A pin the API cannot place in any zone is reported, not saved.
  await location.getByLabel("Latitude").fill("60.5")
  await location.getByRole("button", { name: "Check zone" }).click()
  await expect(location.getByText(/Something went wrong|outside/i)).toBeVisible()
})

test("delivery and timing are checked before saving, then saved", async ({ page }) => {
  const seen = await open(page, 1)
  const delivery = form(page, "Delivery and timing")

  await delivery.getByLabel("Minimum prep time").fill("5")
  await delivery.getByRole("button", { name: "Save changes" }).click()
  await expect(delivery.getByRole("alert")).toContainText("at least 10 minutes")
  expect(saved(seen, "/delivery")).toBeUndefined()

  await delivery.getByLabel("Minimum prep time").fill("15")
  await delivery.getByLabel("Maximum prep time").fill("35")
  await delivery.getByLabel("Delivery fee").fill("30")
  await delivery.getByLabel("Delivery mode").selectOption("PICKUP")
  await delivery.getByRole("switch", { name: "Cash on delivery" }).click()
  await delivery.getByRole("button", { name: "Save changes" }).click()

  await expect(toast(page, "Delivery and timing saved")).toBeVisible()
  expect(saved(seen, "/delivery")?.body).toEqual({
    deliveryMode: "PICKUP",
    deliveryRadiusKm: 7,
    deliveryFee: 30,
    codEnabled: false,
    prepTimeUnit: "min",
    prepTimeMin: 15,
    prepTimeMax: 35,
  })
})

test("order options send only what changed, and an option Foodi turned off cannot be enabled", async ({ page }) => {
  const seen = await open(page, 1)
  const options = form(page, "Order options")
  await expect(options.getByRole("switch", { name: "Dine-in" })).toBeDisabled()
  await expect(options).toContainText("Turned off by Foodi")

  await options.getByRole("button", { name: "Save changes" }).click()
  await expect(options.getByRole("alert")).toContainText("Nothing has changed")

  await options.getByRole("switch", { name: "Halal tag" }).click()
  await options.getByLabel("Minimum order amount").fill("150")
  await options.getByRole("button", { name: "Save changes" }).click()
  await expect(toast(page, "Order options saved")).toBeVisible()
  expect(saved(seen, "/settings")?.body).toEqual({ halalTag: true, minimumOrder: 150 })
})

test("the owner uploads and removes the logo", async ({ page }) => {
  const seen = await open(page, 2)
  const images = page.getByRole("region", { name: "Images" })
  await expect(images.getByText("No logo yet")).toBeVisible()

  const png = Buffer.from(PIXEL.split(",")[1] as string, "base64")
  await images.locator('input[type="file"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png })
  await expect(images.getByRole("img", { name: "Beta Bistro logo" })).toBeVisible()
  const upload = seen.find((r) => r.method === "PUT")
  expect(upload?.path).toBe("/seller/restaurant/profile/files/logo")
  expect(upload?.sellerId).toBe("2")
  expect(upload?.contentType).toContain("multipart/form-data")

  // Files the API would refuse anyway are stopped before upload.
  await images.locator('input[type="file"]').first().setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") })
  await expect(images.getByRole("alert")).toContainText("JPG, PNG or WebP")

  await images.getByRole("button", { name: "Remove logo" }).click()
  await expect(images.getByText("No logo yet")).toBeVisible()
  expect(seen.some((r) => r.method === "DELETE" && r.path.endsWith("/files/logo"))).toBe(true)
})

test("a restaurant the API refuses is shown as an error, never as another restaurant's data", async ({ page }) => {
  await mockOwnerSession(page, RESTAURANTS)
  await page.route("**/api/v1/seller/restaurant/profile", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Restaurant not found" } }) })
  )
  await page.addInitScript(() => window.localStorage.setItem("foodi.activeRestaurant", "1"))
  await gotoAndSettle(page, "/settings/profile")
  await expect(page.getByRole("alert").filter({ hasText: "Restaurant not found" })).toBeVisible()
  await expect(page.locator("main")).not.toContainText("Alpha Road")
})
