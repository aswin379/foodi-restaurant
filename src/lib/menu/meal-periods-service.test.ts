// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { emptyWeek } from "@/lib/hours/weekly-hours"
import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { parseMenuCommand } from "./commands"
import { listMealPeriods, listMenuCategories, performMenuCommand } from "./service"

vi.mock("next/server", () => ({ connection: async () => {} }))
vi.mock("next/cache", () => ({ refresh: () => {} }))

const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const OTHER_KEY = "2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const lunchDraft = {
  name: "Brunch",
  days: { ...emptyWeek(), sun: { enabled: true, allDay: false, windows: [{ key: "a", start: "10:00", end: "13:00" }] } },
}

beforeEach(() => {
  vi.stubEnv("FOODI_MENU_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

describe("meal periods data source (B3b)", () => {
  it("refuses preview meal periods and simulated changes in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview"]) {
      vi.stubEnv("FOODI_MENU_DATA_SOURCE", value)
      await expect(listMealPeriods()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(
        performMenuCommand({ type: "save_meal_period", periodId: null, version: null, draft: lunchDraft }, KEY)
      ).rejects.toMatchObject({ kind: "not_configured" })
      await expect(performMenuCommand({ type: "archive_meal_period", periodId: "prv-meal-lunch" }, KEY)).rejects.toMatchObject({
        kind: "not_configured",
      })
    }
  })

  it("doesn't fall back to preview data when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(listMealPeriods()).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("lists labelled sample periods in preview, with usage, and no presets for a real restaurant", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "preview")
    const periods = await listMealPeriods()
    expect(periods.every((period) => period.id.startsWith("prv-"))).toBe(true)
    expect(periods.find((period) => period.name === "Lunch")?.usage.items.map((ref) => ref.name).sort()).toEqual([
      "Lemon rice",
      "Paneer butter masala",
    ])
    expect(periods.find((period) => period.name === "Breakfast")?.usage.categories.map((ref) => ref.name)).toEqual(["Breakfast"])
    expect(periods.at(-1)?.status).toBe("archived")
    expect(await listMealPeriods("empty")).toEqual([])
    // The sample category schedule reads through the same adapter.
    expect((await listMenuCategories()).find((category) => category.name === "Breakfast")?.schedule.mode).toBe("meal_periods")
  })

  it("keeps a simulated save, replays a repeated key and refuses a reused one", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "preview")
    const command = { type: "save_meal_period" as const, periodId: null, version: null, draft: lunchDraft }
    const first = await performMenuCommand(command, KEY)
    expect(await performMenuCommand(command, KEY)).toEqual(first)
    await expect(performMenuCommand({ ...command, draft: { ...lunchDraft, name: "Other" } }, KEY)).rejects.toMatchObject({ kind: "conflict" })
    expect((await listMealPeriods()).filter((period) => period.name === "Brunch")).toHaveLength(1)
    await expect(performMenuCommand({ type: "archive_meal_period", periodId: "prv-meal-lunch" }, OTHER_KEY)).rejects.toMatchObject({
      kind: "conflict",
      userMessage: "Lunch is used by 2 items. Change their schedules first.",
    })
  })

  it("labels a preview save as preview in the Server Action result", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "preview")
    const { readMealPeriods, runMenuCommand } = await import("@/app/(dashboard)/menu/actions")
    const saved = await runMenuCommand({ command: { type: "save_meal_period", periodId: null, version: null, draft: lunchDraft }, idempotencyKey: KEY })
    expect(saved).toMatchObject({ ok: true, preview: true, data: { kind: "meal_period" } })
    expect(await readMealPeriods()).toMatchObject({ ok: true, preview: true })

    vi.stubEnv("NODE_ENV", "production")
    expect(await readMealPeriods()).toMatchObject({ ok: false, reason: "not_configured" })
  })
})

describe("parsing meal-period commands", () => {
  it("validates the draft and needs the loaded version for an edit", () => {
    expect(parseMenuCommand({ type: "save_meal_period", periodId: null, version: null, draft: lunchDraft })).toMatchObject({ ok: true })
    expect(parseMenuCommand({ type: "save_meal_period", periodId: "prv-meal-lunch", draft: lunchDraft })).toEqual({
      ok: false,
      fieldErrors: { command: "Unknown action." },
    })
    expect(parseMenuCommand({ type: "save_meal_period", periodId: null, version: null, draft: { name: "", days: {} } })).toEqual({
      ok: false,
      fieldErrors: { "period.name": "Enter the meal period name.", "period.days": "Choose at least one day." },
    })
    expect(parseMenuCommand({ type: "delete_meal_period", periodId: "bad id" })).toMatchObject({ ok: false })
  })

  it("keeps a category's saved schedule when the draft leaves it out", () => {
    const parsed = parseMenuCommand({
      type: "save_category",
      categoryId: "prv-cat-mains",
      draft: { name: "Mains", description: "", active: true, channels: { delivery: true, takeaway: true, dine_in: true } },
    })
    if (!parsed.ok || parsed.command.type !== "save_category") throw new Error("expected a category save")
    expect("schedule" in parsed.command.draft).toBe(false)
    const off = parseMenuCommand({
      type: "save_category",
      categoryId: "prv-cat-mains",
      draft: {
        name: "Mains",
        channels: { delivery: false, takeaway: true, dine_in: true },
        schedule: { mode: "meal_periods", periods: [{ periodId: "prv-meal-lunch", channels: ["delivery"] }] },
      },
    })
    // The category's own order types are the limit for its schedule.
    expect(off).toEqual({
      ok: false,
      fieldErrors: {
        "schedule.periods.prv-meal-lunch.channels": "Delivery is off for this category. Untick it here, or turn it on under Order types.",
      },
    })
  })
})
