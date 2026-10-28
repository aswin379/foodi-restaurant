// @vitest-environment node
import { describe, expect, it } from "vitest"

import { parseSettingsCommand } from "./commands"
import type { OrderSettings } from "./types"
import {
  COVER_MAX_BYTES,
  LOGO_MAX_BYTES,
  orderSettingsDraftFrom,
  orderSettingsDraftFromInput,
  orderSettingsFromDraft,
  profileDraftFromInput,
  SERVER_ACTION_BODY_LIMIT,
  turnedOff,
  validateOrderSettingsDraft,
  validateProfileDraft,
  type OrderSettingsDraft,
  type ProfileDraft,
} from "./validation"

/** A WebP data URL that decodes to exactly `bytes` bytes. */
const dataUrlOf = (bytes: number) => `data:image/webp;base64,${Buffer.alloc(bytes, 7).toString("base64")}`

// A 1×1 PNG, as the browser would send it after compression.
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

function profile(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return {
    name: "Spice Route",
    description: "",
    phone: "",
    email: "",
    line1: "12 Sample Street",
    line2: "",
    city: "Bengaluru",
    region: "",
    postalCode: "560001",
    latitude: "",
    longitude: "",
    logo: { kind: "keep" },
    cover: { kind: "keep" },
    ...overrides,
  }
}

function orders(overrides: Partial<OrderSettingsDraft> = {}): OrderSettingsDraft {
  return {
    orderTypes: {
      delivery: { enabled: true, defaultPrepMinutes: "20" },
      takeaway: { enabled: true, defaultPrepMinutes: "15" },
      dine_in: { enabled: false, defaultPrepMinutes: "25" },
    },
    minimumOrder: "",
    pickupCodeRequired: false,
    ...overrides,
  }
}

describe("profile validation", () => {
  it("accepts a minimal valid profile", () => {
    expect(validateProfileDraft(profile())).toEqual({})
  })

  it("needs a name, address line, city and postal code, within limits", () => {
    expect(validateProfileDraft(profile({ name: " ", line1: "", city: "", postalCode: "" }))).toEqual({
      name: "Enter the restaurant name.",
      "address.line1": "Enter the address.",
      "address.city": "Enter the city.",
      "address.postalCode": "Enter the postal code.",
    })
    expect(validateProfileDraft(profile({ name: "x".repeat(81) })).name).toBe("Keep the restaurant name under 80 characters.")
    expect(validateProfileDraft(profile({ description: "x".repeat(501) })).description).toMatch(/under 500/)
  })

  it("checks phone and email only when given", () => {
    expect(validateProfileDraft(profile({ phone: "+91 98765 43210", email: "owner@example.com" }))).toEqual({})
    expect(validateProfileDraft(profile({ phone: "12345" })).phone).toMatch(/7 to 15 digits/)
    expect(validateProfileDraft(profile({ phone: "call me" })).phone).toMatch(/7 to 15 digits/)
    expect(validateProfileDraft(profile({ email: "owner@" })).email).toMatch(/email address/)
  })

  it("takes coordinates as a pair, in range, with up to 6 decimals (D3)", () => {
    expect(validateProfileDraft(profile({ latitude: "12.971599", longitude: "77.594566" }))).toEqual({})
    expect(validateProfileDraft(profile({ latitude: "12.97" }))).toEqual({ "location.longitude": "Enter the longitude too, or clear both." })
    expect(validateProfileDraft(profile({ longitude: "77.5" }))).toEqual({ "location.latitude": "Enter the latitude too, or clear both." })
    const bad = validateProfileDraft(profile({ latitude: "91", longitude: "77.1234567" }))
    expect(bad["location.latitude"]).toMatch(/between -90 and 90/)
    expect(bad["location.longitude"]).toMatch(/between -180 and 180/)
  })

  it("checks replaced images for type and size, like menu images", () => {
    expect(validateProfileDraft(profile({ logo: { kind: "replace", dataUrl: TINY_PNG } }))).toEqual({})
    expect(validateProfileDraft(profile({ logo: { kind: "replace", dataUrl: "data:image/gif;base64,R0lGOD" } })).logo).toBe(
      "Choose a JPG, PNG or WebP image."
    )
    const huge = `data:image/png;base64,${"A".repeat(1_000_000)}`
    expect(validateProfileDraft(profile({ cover: { kind: "replace", dataUrl: huge } })).cover).toMatch(/too large/)
  })

  it("holds the logo and cover to their own budgets", () => {
    const image = (bytes: number) => ({ kind: "replace" as const, dataUrl: dataUrlOf(bytes) })
    expect(validateProfileDraft(profile({ logo: image(LOGO_MAX_BYTES), cover: image(COVER_MAX_BYTES) }))).toEqual({})
    const over = validateProfileDraft(profile({ logo: image(LOGO_MAX_BYTES + 1), cover: image(COVER_MAX_BYTES + 1) }))
    expect(over.logo).toMatch(/too large after compression/)
    expect(over.cover).toMatch(/too large after compression/)
  })

  it("keeps a worst-case save with both images under the 1 MB request limit", () => {
    // Every text field at its parsing cap, and both images at their budget.
    const longest = profile({
      name: "n".repeat(500),
      description: "d".repeat(2000),
      phone: "1".repeat(100),
      email: "e".repeat(500),
      line1: "a".repeat(500),
      line2: "b".repeat(500),
      city: "c".repeat(500),
      region: "r".repeat(500),
      postalCode: "p".repeat(100),
      latitude: "1".repeat(30),
      longitude: "1".repeat(30),
      logo: { kind: "replace", dataUrl: dataUrlOf(LOGO_MAX_BYTES) },
      cover: { kind: "replace", dataUrl: dataUrlOf(COVER_MAX_BYTES) },
    })
    const body = JSON.stringify([{ command: { type: "save_profile", version: "v".repeat(100), draft: longest }, idempotencyKey: "k".repeat(36) }])
    expect(new TextEncoder().encode(body).length).toBeLessThan(SERVER_ACTION_BODY_LIMIT * 0.95)
  })

  it("builds a well-typed draft from untrusted input", () => {
    expect(profileDraftFromInput({ name: 5, logo: { kind: "replace", dataUrl: TINY_PNG }, cover: { kind: "steal" } })).toMatchObject({
      name: "",
      logo: { kind: "replace", dataUrl: TINY_PNG },
      cover: { kind: "keep" },
    })
  })
})

describe("order-settings validation", () => {
  it("accepts per-order-type prep defaults and a blank minimum", () => {
    expect(validateOrderSettingsDraft(orders())).toEqual({})
  })

  it("needs every prep default to be 5–180 whole minutes, per order type", () => {
    const draft = orders()
    draft.orderTypes.takeaway.defaultPrepMinutes = "4"
    draft.orderTypes.dine_in.defaultPrepMinutes = "12.5"
    expect(validateOrderSettingsDraft(draft)).toEqual({
      "orderTypes.takeaway.defaultPrepMinutes": "Enter a takeaway prep time from 5 to 180 minutes.",
      "orderTypes.dine_in.defaultPrepMinutes": "Enter a dine-in prep time from 5 to 180 minutes.",
    })
  })

  it("checks the one restaurant-wide minimum order as an amount (D5): blank is none, zero is refused", () => {
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "" }))).toEqual({})
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "  " }))).toEqual({})
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "150.50" }))).toEqual({})
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "0.01" }))).toEqual({})
    for (const zero of ["0", "0.00", "000"]) {
      expect(validateOrderSettingsDraft(orders({ minimumOrder: zero })).minimumOrder).toBe(
        "Enter an amount above 0, or leave it blank for no minimum."
      )
    }
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "1.234" })).minimumOrder).toMatch(/two decimals/)
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "-5" })).minimumOrder).toMatch(/two decimals/)
    expect(validateOrderSettingsDraft(orders({ minimumOrder: "abc" })).minimumOrder).toMatch(/two decimals/)
    expect(orderSettingsFromDraft(orders({ minimumOrder: "150.50" }), "INR").minimumOrder).toEqual({ amountMinor: 15050, currency: "INR" })
    expect(orderSettingsFromDraft(orders(), "INR").minimumOrder).toBeNull()
  })

  it("keeps at least one order type on", () => {
    const draft = orders()
    draft.orderTypes.delivery.enabled = false
    draft.orderTypes.takeaway.enabled = false
    expect(validateOrderSettingsDraft(draft).orderTypes).toMatch(/at least one order type/)
  })

  it("names the order types a draft turns off (the D6 warning)", () => {
    const saved = {
      orderTypes: { delivery: { enabled: true, defaultPrepMinutes: 20 }, takeaway: { enabled: true, defaultPrepMinutes: 15 }, dine_in: { enabled: false, defaultPrepMinutes: 25 } },
    } as OrderSettings
    const draft = orderSettingsDraftFrom({ ...saved, minimumOrder: null, pickupCodeRequired: false, version: "v", updatedAt: null, updatedBy: null })
    expect(turnedOff(saved, draft)).toEqual([])
    draft.orderTypes.delivery.enabled = false
    draft.orderTypes.dine_in.enabled = true
    expect(turnedOff(saved, draft)).toEqual(["delivery"])
  })

  it("ignores unknown order types and coerces untrusted input", () => {
    const draft = orderSettingsDraftFromInput({
      orderTypes: { delivery: { enabled: "yes", defaultPrepMinutes: 20 }, curbside: { enabled: true, defaultPrepMinutes: "10" } },
      minimumOrder: 100,
      pickupCodeRequired: "true",
    })
    expect(draft).toEqual({
      orderTypes: {
        delivery: { enabled: false, defaultPrepMinutes: "" },
        takeaway: { enabled: false, defaultPrepMinutes: "" },
        dine_in: { enabled: false, defaultPrepMinutes: "" },
      },
      minimumOrder: "",
      pickupCodeRequired: false,
    })
  })
})

describe("parseSettingsCommand", () => {
  it("needs the loaded version and a valid draft", () => {
    expect(parseSettingsCommand({ type: "save_profile", draft: profile() })).toEqual({ ok: false, fieldErrors: { command: "Unknown action." } })
    expect(parseSettingsCommand({ type: "save_profile", version: "prv-profile-1", draft: profile() })).toMatchObject({ ok: true })
    expect(parseSettingsCommand({ type: "save_order_settings", version: "v1", draft: { ...orders(), minimumOrder: "x" } })).toMatchObject({
      ok: false,
      fieldErrors: { minimumOrder: expect.any(String) },
    })
    expect(parseSettingsCommand({ type: "save_charges", version: "v1" })).toEqual({ ok: false, fieldErrors: { command: "Unknown action." } })
    // The Server Action refuses a zero minimum too, with the same message.
    expect(parseSettingsCommand({ type: "save_order_settings", version: "v1", draft: { ...orders(), minimumOrder: "0" } })).toEqual({
      ok: false,
      fieldErrors: { minimumOrder: "Enter an amount above 0, or leave it blank for no minimum." },
    })
  })
})
