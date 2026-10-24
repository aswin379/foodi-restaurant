// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"

import { categoryFromApi, commandResultFromApi, commandToApi } from "./api-mapping"
import { apiMenuAdapter } from "./api-source"
import { mealPeriodFromApi } from "./meal-periods-api"
import { scheduleDraftToApi, scheduleFromApi, scheduleToApi } from "./schedule-api"
import { categoryDraft, itemDraft } from "./test-drafts"
import type { MenuCategory } from "./types"

// B3b API mapping: meal-period schedules, category schedules and meal
// periods. As in api-mapping.test.ts, takeaway is "pickup" in the API, to
// prove every order type goes through the mapping layer.
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

const ALL_ON = { delivery: true, takeaway: true, dine_in: true }
const refused = expect.objectContaining({ kind: "unavailable" })

const apiPeriod = {
  id: "meal-lunch",
  name: "Lunch",
  status: "active",
  weekly: [{ days: ["mon", "tue"], allDay: false, windows: [{ start: "12:00", end: "15:00" }] }],
  usage: { items: [{ id: "item-1", name: "Dal", archived: false }], categories: [] },
  usedOnOrders: true,
  version: "v7",
  updatedAt: "2026-10-24T05:00:00Z",
  updatedBy: "Owner",
}

const apiCategory = {
  id: "cat-1",
  name: "Breakfast",
  description: null,
  position: 1,
  active: true,
  channels: { delivery: false, pickup: true, dine_in: true },
  archived: false,
  usedOnOrders: true,
  itemCount: 2,
}

describe("meal-period schedules in the API", () => {
  it("map each reference's order types both ways", () => {
    const schedule = { mode: "meal_periods" as const, periods: [{ periodId: "meal-lunch", channels: ["takeaway" as const, "dine_in" as const] }] }
    const wire = scheduleToApi(schedule)
    expect(wire).toEqual({ mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["pickup", "dine_in"] }] })
    expect(scheduleFromApi(wire, ALL_ON)).toEqual(schedule)
    expect(scheduleDraftToApi(schedule)).toEqual(wire)
  })

  it("are read strictly: no fallback order types, no unknown values", () => {
    expect(() => scheduleFromApi({ mode: "meal_periods" }, ALL_ON)).toThrow(refused)
    expect(() => scheduleFromApi({ mode: "meal_periods", periods: [{ periodId: "meal-lunch" }] }, ALL_ON)).toThrow(refused)
    expect(() => scheduleFromApi({ mode: "meal_periods", periods: [{ periodId: "", channels: [] }] }, ALL_ON)).toThrow(refused)
    expect(() => scheduleFromApi({ mode: "meal_periods", periods: [{ periodId: "x", channels: ["curbside"] }] }, ALL_ON)).toThrow(refused)
    expect(() => scheduleFromApi({ mode: "seasonal" }, ALL_ON)).toThrow(refused)
  })

  it("leave B2 schedules exactly as they were read before", () => {
    expect(scheduleFromApi(undefined, ALL_ON)).toEqual({ mode: "always" })
    expect(scheduleFromApi({ mode: "always" }, ALL_ON)).toEqual({ mode: "always" })
    // The older shape without per-window channels still takes the item's order types.
    expect(
      scheduleFromApi({ mode: "custom", timeZone: "Asia/Kolkata", weekly: [{ days: ["mon"], windows: [{ start: "12:00", end: "15:00" }] }] }, {
        delivery: true,
        takeaway: false,
        dine_in: true,
      })
    ).toEqual({
      mode: "custom",
      timeZone: "Asia/Kolkata",
      weekly: [{ days: ["mon"], allDay: null, windows: [{ start: "12:00", end: "15:00", channels: ["delivery", "dine_in"] }] }],
    })
  })
})

describe("category schedules in the API", () => {
  it("treat a missing schedule as always available, as before B3b", () => {
    expect(categoryFromApi(apiCategory as unknown as MenuCategory).schedule).toEqual({ mode: "always" })
    expect(categoryFromApi({ ...apiCategory, schedule: null } as unknown as MenuCategory).schedule).toEqual({ mode: "always" })
  })

  it("read a schedule against the category's own order types", () => {
    const category = categoryFromApi({
      ...apiCategory,
      schedule: { mode: "custom", timeZone: "Asia/Kolkata", weekly: [{ days: ["mon"], windows: [{ start: "07:00", end: "11:00" }] }] },
    } as unknown as MenuCategory)
    expect(category.channels).toEqual({ delivery: false, takeaway: true, dine_in: true })
    expect(category.schedule).toMatchObject({ weekly: [{ windows: [{ channels: ["takeaway", "dine_in"] }] }] })
    expect(() =>
      categoryFromApi({ ...apiCategory, schedule: { mode: "meal_periods", periods: [{ periodId: "m", channels: ["takeaway"] }] } } as unknown as MenuCategory)
    ).toThrow(refused)
  })

  it("send the category schedule draft in API names, and nothing when it's left out", () => {
    const draft = categoryDraft({ schedule: { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway"] }] } })
    expect(commandToApi({ type: "save_category", categoryId: "cat-1", draft })).toMatchObject({
      draft: { channels: { pickup: true }, schedule: { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["pickup"] }] } },
    })
    const without = commandToApi({ type: "save_category", categoryId: "cat-1", draft: categoryDraft() }) as { draft: Record<string, unknown> }
    expect("schedule" in without.draft).toBe(false)
  })

  it("send an item's meal-period draft in API names", () => {
    const draft = itemDraft({ schedule: { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway", "delivery"] }] } })
    expect(commandToApi({ type: "save_item", itemId: null, draft })).toMatchObject({
      draft: { schedule: { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["pickup", "delivery"] }] } },
    })
  })
})

describe("meal periods from the API", () => {
  it("are parsed strictly, with no order types to map", () => {
    expect(mealPeriodFromApi(apiPeriod)).toEqual(apiPeriod)
    expect(() => mealPeriodFromApi({ ...apiPeriod, status: "paused" })).toThrow(refused)
    expect(() => mealPeriodFromApi({ ...apiPeriod, usedOnOrders: "yes" })).toThrow(refused)
    expect(() => mealPeriodFromApi({ ...apiPeriod, version: undefined })).toThrow(refused)
    expect(() => mealPeriodFromApi({ ...apiPeriod, weekly: [{ days: ["funday"], allDay: false, windows: [] }] })).toThrow(refused)
    expect(() => mealPeriodFromApi({ ...apiPeriod, weekly: [{ days: ["mon"], allDay: false, windows: [{ start: "25:00", end: "26:00" }] }] })).toThrow(refused)
    expect(() => mealPeriodFromApi({ ...apiPeriod, usage: { items: [{ id: "x" }], categories: [] } })).toThrow(refused)
  })

  it("come from the proposed path, and command results are mapped", async () => {
    response = [apiPeriod]
    expect(await apiMenuAdapter.listMealPeriods()).toEqual([apiPeriod])
    expect(requests[0]).toMatchObject({ method: "GET", path: "/seller/menu/meal-periods" })
    response = { not: "a list" }
    await expect(apiMenuAdapter.listMealPeriods()).rejects.toMatchObject({ kind: "unavailable" })

    expect(() => commandResultFromApi({ kind: "meal_period", period: { ...apiPeriod, status: "x" } } as never)).toThrow(refused)
    response = { kind: "meal_period", period: apiPeriod }
    await apiMenuAdapter.act({ type: "archive_meal_period", periodId: "meal-lunch" }, "key-1")
    expect(requests.at(-1)).toMatchObject({
      method: "POST",
      path: "/seller/menu/commands",
      idempotencyKey: "key-1",
      body: { type: "archive_meal_period", periodId: "meal-lunch" },
    })
  })
})
