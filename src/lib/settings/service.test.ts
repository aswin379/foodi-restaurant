// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"
import { getWeeklyHours } from "@/lib/hours/service"
import { listMenuCategories, listMenuItems } from "@/lib/menu/service"
import { parseMenuItemListQuery } from "@/lib/menu/query"
import { getOrderBoard, performOrderCommand } from "@/lib/orders/service"

import { ACTION_FAILURE_MESSAGES } from "@/lib/data-source/result"

import {
  getOrderSettings,
  getRestaurantProfile,
  performSettingsCommand,
  resetSettingsPreview,
  setSettingsPreviewSaveRefusal,
  settingsMode,
  settingsPreviewRefusesSaves,
} from "./service"
import { orderSettingsDraftFrom, profileDraftFrom } from "./validation"

vi.mock("next/server", () => ({ connection: async () => {} }))
vi.mock("next/cache", () => ({ refresh: () => {} }))

const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const OTHER_KEY = "2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const THIRD_KEY = "3d9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"

beforeEach(() => {
  vi.stubEnv("FOODI_RESTAURANT_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  for (const name of ["FOODI_RESTAURANT_DATA_SOURCE", "FOODI_HOURS_DATA_SOURCE", "FOODI_MENU_DATA_SOURCE", "FOODI_ORDERS_DATA_SOURCE"]) {
    vi.stubEnv(name, "preview")
  }
}

describe("settings data source", () => {
  it("refuses preview data and simulated changes in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview"]) {
      vi.stubEnv("FOODI_RESTAURANT_DATA_SOURCE", value)
      expect(settingsMode()).toBe("api")
      await expect(getRestaurantProfile()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getOrderSettings()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(
        performSettingsCommand({ type: "save_order_settings", version: "x", draft: { orderTypes: { delivery: { enabled: true, defaultPrepMinutes: "20" }, takeaway: { enabled: true, defaultPrepMinutes: "20" }, dine_in: { enabled: true, defaultPrepMinutes: "20" } }, minimumOrder: "", pickupCodeRequired: false } }, KEY)
      ).rejects.toMatchObject({ kind: "not_configured" })
      await expect(resetSettingsPreview()).rejects.toMatchObject({ kind: "forbidden" })
      await expect(setSettingsPreviewSaveRefusal(true)).rejects.toMatchObject({ kind: "forbidden" })
      expect(() => settingsPreviewRefusesSaves()).toThrow(expect.objectContaining({ kind: "forbidden" }))
    }
  })

  it("doesn't fall back to preview data when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(getRestaurantProfile()).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("labels the sample profile and keeps the shared context's zone, currency and language", async () => {
    preview()
    const profile = await getRestaurantProfile()
    expect(profile.description).toContain("(preview)")
    expect(profile).toMatchObject({ timeZone: "Asia/Kolkata", currency: "INR", locale: "en-IN" })
    await expect(getRestaurantProfile("forbidden")).rejects.toMatchObject({ kind: "forbidden" })
  })

  it("keeps a simulated save, replays a repeated key, refuses a reused key and a stale version, and resets", async () => {
    preview()
    const profile = await getRestaurantProfile()
    const command = { type: "save_profile" as const, version: profile.version, draft: { ...profileDraftFrom(profile), name: "Spice Route" } }
    const first = await performSettingsCommand(command, KEY)
    expect(await performSettingsCommand(command, KEY)).toEqual(first)
    await expect(performSettingsCommand({ ...command, draft: { ...command.draft, name: "Other" } }, KEY)).rejects.toMatchObject({ kind: "conflict" })
    // The same change with a new key is now stale: someone saved since this version.
    await expect(performSettingsCommand(command, OTHER_KEY)).rejects.toMatchObject({ kind: "conflict", userMessage: expect.stringMatching(/changed since/) })
    expect((await getRestaurantProfile()).name).toBe("Spice Route")
    await resetSettingsPreview()
    expect((await getRestaurantProfile()).name).not.toBe("Spice Route")
  })

  it("turns an order type off without changing hours or menu settings (D6)", async () => {
    preview()
    const hoursBefore = await getWeeklyHours()
    const query = parseMenuItemListQuery({ page: "1" })
    const itemsBefore = await listMenuItems({ ...query, pageSize: 100 })
    const categoriesBefore = await listMenuCategories()

    const ordersBefore = await getOrderBoard()

    const settings = await getOrderSettings()
    const draft = orderSettingsDraftFrom(settings)
    draft.orderTypes.delivery.enabled = false
    await performSettingsCommand({ type: "save_order_settings", version: settings.version, draft }, KEY)
    expect((await getOrderSettings()).orderTypes.delivery.enabled).toBe(false)

    expect(await getWeeklyHours()).toEqual(hoursBefore)
    expect(hoursBefore.byOrderType.delivery.length).toBeGreaterThan(0)
    expect(await listMenuItems({ ...query, pageSize: 100 })).toEqual(itemsBefore)
    expect(await listMenuCategories()).toEqual(categoriesBefore)
    // Orders already placed, delivery ones included, are untouched.
    expect(ordersBefore.some((order) => order.orderType === "delivery")).toBe(true)
    expect(await getOrderBoard()).toEqual(ordersBefore)
  })

  it("refuses saves as for a non-owner when the preview tool is on, with the standard message", async () => {
    preview()
    const { runSettingsCommand } = await import("@/app/(dashboard)/settings/actions")
    const settings = await getOrderSettings()
    await setSettingsPreviewSaveRefusal(true)
    expect(settingsPreviewRefusesSaves()).toBe(true)
    const draft = { ...orderSettingsDraftFrom(settings), pickupCodeRequired: true }
    expect(await runSettingsCommand({ command: { type: "save_order_settings", version: settings.version, draft }, idempotencyKey: KEY })).toEqual({
      ok: false,
      reason: "forbidden",
      message: ACTION_FAILURE_MESSAGES.forbidden,
    })
    expect((await getOrderSettings()).pickupCodeRequired).toBe(false)
    await resetSettingsPreview()
    expect(settingsPreviewRefusesSaves()).toBe(false)
  })

  it("requiring a pickup code doesn't change the B1 order lifecycle", async () => {
    preview()
    const settings = await getOrderSettings()
    await performSettingsCommand({ type: "save_order_settings", version: settings.version, draft: { ...orderSettingsDraftFrom(settings), pickupCodeRequired: true } }, KEY)
    expect((await getOrderSettings()).pickupCodeRequired).toBe(true)

    const ready = (await getOrderBoard()).find((order) => order.status === "ready" && order.orderType !== "delivery")
    if (!ready) throw new Error("expected a ready takeaway or dine-in sample order")
    // Complete works exactly as before: no code is asked for or checked by the panel.
    const completed = await performOrderCommand(ready.id, { type: "complete" }, THIRD_KEY)
    expect(completed.status).toBe("completed")
  })

  it("labels a preview save as preview in the Server Action result, and refuses it in production", async () => {
    preview()
    const { runSettingsCommand } = await import("@/app/(dashboard)/settings/actions")
    const settings = await getOrderSettings()
    const result = await runSettingsCommand({ command: { type: "save_order_settings", version: settings.version, draft: orderSettingsDraftFrom(settings) }, idempotencyKey: KEY })
    expect(result).toMatchObject({ ok: true, preview: true, data: { kind: "order_settings" } })
    vi.stubEnv("NODE_ENV", "production")
    expect(
      await runSettingsCommand({ command: { type: "save_order_settings", version: "x", draft: orderSettingsDraftFrom(settings) }, idempotencyKey: OTHER_KEY })
    ).toMatchObject({ ok: false, reason: "not_configured" })
  })
})
