// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"

import { orderSettingsFromApi, profileFromApi } from "./api-mapping"
import { apiSettingsAdapter } from "./api-source"
import { orderSettingsDraftFrom } from "./validation"

// The backend's names aren't decided (PRD §9.1). Pretend it calls takeaway
// "pickup", to prove every order type goes through the mapping layer.
vi.mock("@/lib/api/mapping", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/mapping")>()
  const { ServiceError } = await import("@/lib/data-source/errors")
  return {
    ...original,
    toApiOrderType: (value: string) => (value === "takeaway" ? "pickup" : value),
    fromApiOrderType: (value: string) => {
      if (value === "pickup") return "takeaway"
      if (value === "delivery" || value === "dine_in") return value
      throw new ServiceError("unavailable", `Unknown order type from API: ${value}`)
    },
  }
})

const requests: ApiRequest[] = []
let response: unknown
vi.mock("@/lib/api/transport", () => ({
  getApiTransport: () => ({
    request: async (request: ApiRequest) => {
      requests.push(request)
      return response
    },
  }),
}))

beforeEach(() => {
  requests.length = 0
})

const refused = expect.objectContaining({ kind: "unavailable" })
const apiOrderSettings = {
  orderTypes: {
    delivery: { enabled: true, defaultPrepMinutes: 20 },
    pickup: { enabled: false, defaultPrepMinutes: 10 },
    dine_in: { enabled: true, defaultPrepMinutes: 25 },
  },
  minimumOrder: { amountMinor: 15000, currency: "INR" },
  pickupCodeRequired: true,
  version: "os-4",
  updatedAt: "2026-10-28T05:00:00Z",
  updatedBy: "Owner",
}
const apiProfile = {
  name: "Spice Route",
  description: null,
  contact: { phone: "+91 98765 43210", email: null },
  address: { line1: "12 Sample Street", line2: null, city: "Bengaluru", region: "Karnataka", postalCode: "560001" },
  location: { latitude: 12.97, longitude: 77.59 },
  logoUrl: null,
  coverUrl: null,
  timeZone: "Asia/Kolkata",
  currency: "INR",
  locale: "en-IN",
  version: "p-9",
  updatedAt: null,
  updatedBy: null,
}

describe("settings API mapping", () => {
  it("reads order types as record keys in product names", async () => {
    response = apiOrderSettings
    const settings = await apiSettingsAdapter.getOrderSettings()
    expect(settings.orderTypes.takeaway).toEqual({ enabled: false, defaultPrepMinutes: 10 })
    expect(requests[0]).toMatchObject({ method: "GET", path: "/seller/restaurant/order-settings" })
  })

  it("refuses unknown, missing or malformed order types instead of guessing", () => {
    expect(() => orderSettingsFromApi({ ...apiOrderSettings, orderTypes: { ...apiOrderSettings.orderTypes, curbside: { enabled: true, defaultPrepMinutes: 5 } } })).toThrow(refused)
    expect(() => orderSettingsFromApi({ ...apiOrderSettings, orderTypes: { delivery: apiOrderSettings.orderTypes.delivery, dine_in: apiOrderSettings.orderTypes.dine_in } })).toThrow(refused)
    expect(() => orderSettingsFromApi({ ...apiOrderSettings, orderTypes: { ...apiOrderSettings.orderTypes, delivery: { enabled: "yes", defaultPrepMinutes: 20 } } })).toThrow(refused)
    expect(() => orderSettingsFromApi({ ...apiOrderSettings, pickupCodeRequired: undefined })).toThrow(refused)
  })

  it("reads the profile strictly", () => {
    expect(profileFromApi(apiProfile)).toEqual(apiProfile)
    expect(() => profileFromApi({ ...apiProfile, address: undefined })).toThrow(refused)
    expect(() => profileFromApi({ ...apiProfile, location: { latitude: "12" } })).toThrow(refused)
    expect(() => profileFromApi({ ...apiProfile, timeZone: undefined })).toThrow(refused)
  })

  it("sends saves to the proposed paths with API names, If-Match and the idempotency key", async () => {
    response = apiOrderSettings
    const draft = orderSettingsDraftFrom(orderSettingsFromApi(apiOrderSettings))
    await apiSettingsAdapter.act({ type: "save_order_settings", version: "os-4", draft }, "key-1")
    expect(requests[0]).toMatchObject({
      method: "PUT",
      path: "/seller/restaurant/order-settings",
      ifMatch: "os-4",
      idempotencyKey: "key-1",
      body: { orderTypes: { pickup: { enabled: false, defaultPrepMinutes: "10" } }, pickupCodeRequired: true },
    })
    expect(Object.keys((requests[0].body as { orderTypes: object }).orderTypes)).not.toContain("takeaway")

    response = apiProfile
    await apiSettingsAdapter.act(
      { type: "save_profile", version: "p-9", draft: { name: "x", description: "", phone: "", email: "", line1: "a", line2: "", city: "b", region: "", postalCode: "1", latitude: "", longitude: "", logo: { kind: "keep" }, cover: { kind: "remove" } } },
      "key-2"
    )
    expect(requests[1]).toMatchObject({ method: "PATCH", path: "/seller/restaurant/profile", ifMatch: "p-9", body: { cover: { kind: "remove" } } })
  })
})
