// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"

import { apiMenuAdapter } from "./api-source"
import { channelSettingsFromApi, channelSettingsToApi, commandToApi } from "./api-mapping"
import { emptyDays } from "./schedule"
import { categoryDraft, itemDraft } from "./test-drafts"

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

const apiItem = {
  id: "item-1",
  name: "Butter chicken",
  description: null,
  categoryId: "cat-1",
  categoryName: "Mains",
  price: { amountMinor: 29000, currency: "INR" },
  sizes: [],
  optionGroups: [],
  imageUrl: null,
  dietary: "non_veg",
  allergens: [],
  spiceLevel: "none",
  tags: [],
  calories: null,
  soldOut: null,
  channels: { delivery: true, pickup: false, dine_in: true },
  schedule: {
    mode: "custom",
    timeZone: "Asia/Kolkata",
    weekly: [
      {
        days: ["mon"],
        allDay: { channels: ["dine_in"] },
        windows: [
          { start: "18:00", end: "22:00", channels: ["delivery"] },
          // The older shape: no channels means all the item's order types.
          { start: "07:00", end: "08:00" },
        ],
      },
    ],
  },
  archived: false,
  usedOnOrders: true,
}

describe("item and category order types", () => {
  it("map record keys both ways", () => {
    expect(channelSettingsToApi({ delivery: true, takeaway: false, dine_in: true })).toEqual({
      delivery: true,
      pickup: false,
      dine_in: true,
    })
    expect(channelSettingsFromApi({ delivery: true, pickup: false, dine_in: true })).toEqual({
      delivery: true,
      takeaway: false,
      dine_in: true,
    })
  })

  it("refuse unknown, missing or non-boolean order types", () => {
    const refused = expect.objectContaining({ kind: "unavailable" })
    expect(() => channelSettingsFromApi({ delivery: true, takeaway: true, dine_in: true })).toThrow(refused)
    expect(() => channelSettingsFromApi({ delivery: true, dine_in: true })).toThrow(refused)
    expect(() => channelSettingsFromApi({ delivery: "yes", pickup: true, dine_in: true })).toThrow(refused)
    expect(() => channelSettingsFromApi(["delivery"])).toThrow(refused)
  })
})

describe("API menu adapter", () => {
  it("reads an item's order types and schedule in product names", async () => {
    response = apiItem
    const item = await apiMenuAdapter.getItem("item-1")
    expect(item?.channels).toEqual({ delivery: true, takeaway: false, dine_in: true })
    expect(item?.schedule).toEqual({
      mode: "custom",
      timeZone: "Asia/Kolkata",
      weekly: [
        {
          days: ["mon"],
          allDay: { channels: ["dine_in"] },
          windows: [
            { start: "18:00", end: "22:00", channels: ["delivery"] },
            // Defaults to the item's order types, so not takeaway.
            { start: "07:00", end: "08:00", channels: ["delivery", "dine_in"] },
          ],
        },
      ],
    })

    response = { items: [apiItem], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
    const list = await apiMenuAdapter.listItems({ filter: "all", search: "", categoryId: null, page: 1, pageSize: 20 })
    expect(list.items[0].channels.takeaway).toBe(false)
  })

  it("reads category order types in product names", async () => {
    response = [{ id: "cat-1", name: "Mains", description: null, position: 1, active: true, archived: false, usedOnOrders: true, itemCount: 1, channels: { delivery: false, pickup: true, dine_in: true } }]
    expect((await apiMenuAdapter.listCategories())[0].channels).toEqual({ delivery: false, takeaway: true, dine_in: true })
  })

  it("sends item and category saves with API names, and maps the result back", async () => {
    const schedule = {
      mode: "custom" as const,
      days: {
        ...emptyDays(),
        sat: {
          enabled: true,
          allDay: { channels: ["takeaway" as const] },
          windows: [{ key: "new-a", start: "18:00", end: "22:00", channels: ["delivery" as const] }],
        },
      },
    }
    response = { kind: "item", item: apiItem }
    const result = await apiMenuAdapter.act({ type: "save_item", itemId: null, draft: itemDraft({ schedule }) }, "key-1")
    expect(requests[0].body).toMatchObject({
      draft: {
        channels: { delivery: true, pickup: true, dine_in: true },
        schedule: { days: { sat: { allDay: { channels: ["pickup"] }, windows: [{ channels: ["delivery"] }] } } },
      },
    })
    expect(result).toMatchObject({ kind: "item", item: { channels: { takeaway: false } } })

    expect(commandToApi({ type: "save_category", categoryId: null, draft: categoryDraft() })).toMatchObject({
      draft: { channels: { delivery: true, pickup: true, dine_in: true } },
    })
    // Commands without order types pass through unchanged.
    expect(commandToApi({ type: "archive_item", itemId: "item-1" })).toEqual({ type: "archive_item", itemId: "item-1" })
  })

  it("refuses a response with an unknown order type instead of guessing", async () => {
    response = { ...apiItem, channels: { delivery: true, takeaway: true, dine_in: true } }
    await expect(apiMenuAdapter.getItem("item-1")).rejects.toMatchObject({ kind: "unavailable" })
  })
})
