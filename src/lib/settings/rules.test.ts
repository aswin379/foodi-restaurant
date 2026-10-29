// @vitest-environment node
import { describe, expect, it } from "vitest"

import { applySettingsCommand, type SettingsState } from "./rules"
import { orderSettingsDraftFrom, profileDraftFrom } from "./validation"

const context = { now: new Date("2026-10-28T06:00:00Z"), actor: "Owner", storeImage: (dataUrl: string) => `stored:${dataUrl.length}` }

function state(): SettingsState {
  return {
    profile: {
      name: "Spice Route",
      description: null,
      contact: { phone: null, email: null },
      address: { line1: "12 Sample Street", line2: null, city: "Bengaluru", region: null, postalCode: "560001" },
      location: null,
      logoUrl: "https://cdn.example/logo.webp",
      coverUrl: null,
      timeZone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      version: "profile-3",
      updatedAt: null,
      updatedBy: null,
    },
    orderSettings: {
      orderTypes: {
        delivery: { enabled: true, defaultPrepMinutes: 20 },
        takeaway: { enabled: true, defaultPrepMinutes: 15 },
        dine_in: { enabled: true, defaultPrepMinutes: 20 },
      },
      minimumOrder: null,
      pickupCodeRequired: false,
      version: "orders-1",
      updatedAt: null,
      updatedBy: null,
    },
  }
}

describe("applySettingsCommand", () => {
  it("saves the profile, keeps time zone, currency and language read-only, and bumps the version", () => {
    const draft = { ...profileDraftFrom(state().profile), name: "Spice Route Express", latitude: "12.97", longitude: "77.59" }
    const { result } = applySettingsCommand(state(), { type: "save_profile", version: "profile-3", draft }, context)
    if (result.kind !== "profile") throw new Error("expected a profile")
    expect(result.profile).toMatchObject({
      name: "Spice Route Express",
      location: { latitude: 12.97, longitude: 77.59 },
      logoUrl: "https://cdn.example/logo.webp",
      timeZone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      version: "profile-4",
      updatedBy: "Owner",
    })
  })

  it("keeps, removes or replaces images", () => {
    const draft = { ...profileDraftFrom(state().profile), logo: { kind: "remove" as const }, cover: { kind: "replace" as const, dataUrl: "data:image/png;base64,AAAA" } }
    const { result } = applySettingsCommand(state(), { type: "save_profile", version: "profile-3", draft }, context)
    if (result.kind !== "profile") throw new Error("expected a profile")
    expect(result.profile.logoUrl).toBeNull()
    expect(result.profile.coverUrl).toBe("stored:26")
  })

  it("refuses a stale version for either save, changing nothing", () => {
    const before = state()
    const stale = expect.objectContaining({ kind: "conflict", userMessage: expect.stringMatching(/changed since you opened this page/) })
    expect(() => applySettingsCommand(before, { type: "save_profile", version: "profile-2", draft: profileDraftFrom(before.profile) }, context)).toThrow(stale)
    expect(() =>
      applySettingsCommand(before, { type: "save_order_settings", version: "orders-0", draft: orderSettingsDraftFrom(before.orderSettings) }, context)
    ).toThrow(stale)
    expect(before).toEqual(state())
  })

  it("turns an order type off and saves prep defaults per order type, changing only order settings (D6)", () => {
    const before = state()
    const draft = orderSettingsDraftFrom(before.orderSettings)
    draft.orderTypes.delivery.enabled = false
    draft.orderTypes.takeaway.defaultPrepMinutes = "10"
    draft.minimumOrder = "150"
    draft.pickupCodeRequired = true
    const { state: next, result } = applySettingsCommand(before, { type: "save_order_settings", version: "orders-1", draft }, context)
    if (result.kind !== "order_settings") throw new Error("expected order settings")
    expect(result.orderSettings).toMatchObject({
      orderTypes: { delivery: { enabled: false, defaultPrepMinutes: 20 }, takeaway: { enabled: true, defaultPrepMinutes: 10 } },
      minimumOrder: { amountMinor: 15000, currency: "INR" },
      pickupCodeRequired: true,
      version: "orders-2",
    })
    expect(next.profile).toEqual(before.profile)
    expect(Object.keys(next)).toEqual(["profile", "orderSettings"])
  })
})
