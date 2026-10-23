// @vitest-environment node
import { describe, expect, it } from "vitest"

import { applyMenuCommand, displayPrice, itemStatus, type MenuState, type StoredCategory } from "./rules"
import { emptyDays } from "./schedule"
import { categoryDraft, itemDraft } from "./test-drafts"
import type { MenuItem } from "./types"

const now = new Date("2026-10-23T12:00:00.000Z")
let counter = 0
const context = {
  now,
  actor: "Test staff",
  timeZone: "Europe/London",
  newId: (kind: string) => `new-${kind}-${++counter}`,
}
const ALL = { delivery: true, takeaway: true, dine_in: true }

function category(overrides: Partial<StoredCategory> = {}): StoredCategory {
  return {
    id: "cat-mains",
    name: "Mains",
    description: null,
    position: 1,
    active: true,
    channels: ALL,
    archived: false,
    usedOnOrders: true,
    ...overrides,
  }
}

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "item-1",
    name: "Dal makhani",
    description: null,
    categoryId: "cat-mains",
    categoryName: "Mains",
    price: { amountMinor: 19000, currency: "INR" },
    sizes: [],
    optionGroups: [],
    imageUrl: null,
    dietary: "veg",
    allergens: [],
    spiceLevel: "none",
    tags: [],
    calories: null,
    soldOut: null,
    channels: ALL,
    schedule: { mode: "always" },
    archived: false,
    usedOnOrders: true,
    ...overrides,
  }
}

const state = (overrides: Partial<MenuState> = {}): MenuState => ({
  items: [item()],
  categories: [category(), category({ id: "cat-drinks", name: "Drinks", position: 2 })],
  ...overrides,
})

describe("save_item", () => {
  it("creates an item in an active category, with server-minted ids", () => {
    const draft = itemDraft({
      categoryId: "cat-mains",
      price: "",
      sizes: [
        { key: "client-a", name: "Half", price: "90", available: true },
        { key: "client-b", name: "Full", price: "140", available: false },
      ],
    })
    const { state: next, result } = applyMenuCommand(state(), { type: "save_item", itemId: null, draft }, context)
    if (result.kind !== "item") throw new Error("expected an item")
    expect(next.items).toHaveLength(2)
    expect(result.item.id).toMatch(/^new-item-/)
    expect(result.item.sizes.map((size) => size.id)).toEqual(expect.arrayContaining([expect.stringMatching(/^new-size-/)]))
    expect(result.item.sizes.map((size) => size.id)).not.toContain("client-a")
    // With sizes, the stored base price is the cheapest size.
    expect(result.item.price.amountMinor).toBe(9000)
    expect(result.item.categoryName).toBe("Mains")
  })

  it("refuses a missing or archived category (D7)", () => {
    const archived = state({ categories: [category({ archived: true })] })
    expect(() =>
      applyMenuCommand(archived, { type: "save_item", itemId: null, draft: itemDraft({ categoryId: "cat-mains" }) }, context)
    ).toThrow(expect.objectContaining({ kind: "validation", fieldErrors: { categoryId: expect.any(String) } }))
  })

  it("keeps existing ids, image and order history when editing", () => {
    const existing = item({
      imageUrl: "data:image/webp;base64,AAAA",
      sizes: [{ id: "size-1", name: "Half", price: { amountMinor: 9000, currency: "INR" }, available: true }],
    })
    const draft = itemDraft({
      categoryId: "cat-mains",
      sizes: [
        { key: "size-1", name: "Half", price: "95", available: true },
        { key: "client-x", name: "Full", price: "150", available: true },
      ],
    })
    const { result } = applyMenuCommand(state({ items: [existing] }), { type: "save_item", itemId: "item-1", draft }, context)
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.sizes[0]).toMatchObject({ id: "size-1", price: { amountMinor: 9500 } })
    expect(result.item.imageUrl).toBe("data:image/webp;base64,AAAA")
    expect(result.item.usedOnOrders).toBe(true)
  })

  it("derives single-choice limits and stores group rules", () => {
    const draft = itemDraft({
      categoryId: "cat-mains",
      groups: [
        {
          key: "g",
          name: "Spice",
          selection: "single",
          required: true,
          min: "7",
          max: "9",
          options: [{ key: "o", name: "Mild", price: "", available: true }],
        },
      ],
    })
    const { result } = applyMenuCommand(state(), { type: "save_item", itemId: null, draft }, context)
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.optionGroups[0]).toMatchObject({ selection: "single", required: true, min: 1, max: 1 })
    expect(result.item.optionGroups[0].options[0].price.amountMinor).toBe(0)
  })

  it("stores the schedule in the server's time zone, not one sent by the browser", () => {
    const draft = itemDraft({
      categoryId: "cat-mains",
      schedule: {
        mode: "custom",
        days: {
          ...emptyDays(),
          mon: {
            enabled: true,
            allDay: null,
            windows: [
              { key: "a", start: "12:00", end: "15:00", channels: ["delivery"] },
              { key: "b", start: "14:00", end: "16:00", channels: ["delivery"] },
            ],
          },
        },
      },
    })
    const { result } = applyMenuCommand(state(), { type: "save_item", itemId: null, draft }, context)
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.schedule).toEqual({
      mode: "custom",
      timeZone: "Europe/London",
      weekly: [{ days: ["mon"], allDay: null, windows: [{ start: "12:00", end: "16:00", channels: ["delivery"] }] }],
    })
  })

  it("refuses to edit an archived item", () => {
    expect(() =>
      applyMenuCommand(state({ items: [item({ archived: true })] }), { type: "save_item", itemId: "item-1", draft: itemDraft({ categoryId: "cat-mains" }) }, context)
    ).toThrow(expect.objectContaining({ kind: "conflict" }))
  })
})

describe("sold out", () => {
  it("records until, reason, time and who", () => {
    const { result } = applyMenuCommand(
      state(),
      { type: "set_sold_out", itemId: "item-1", until: "for_2h", reason: "Oven down" },
      context
    )
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.soldOut).toEqual({
      until: { at: "2026-10-23T14:00:00.000Z" },
      reason: "Oven down",
      since: now.toISOString(),
      by: "Test staff",
    })
  })

  it("makes an item available again", () => {
    const soldOut = item({ soldOut: { until: "manual", reason: null, since: now.toISOString(), by: "x" } })
    const { result } = applyMenuCommand(state({ items: [soldOut] }), { type: "set_available", itemId: "item-1" }, context)
    expect(result).toMatchObject({ kind: "item", item: { soldOut: null } })
  })
})

describe("archive, restore and delete items", () => {
  it("archives, and only deletes items never ordered", () => {
    const archived = applyMenuCommand(state(), { type: "archive_item", itemId: "item-1" }, context)
    expect(archived.result).toMatchObject({ item: { archived: true } })
    expect(() => applyMenuCommand(state(), { type: "delete_item", itemId: "item-1" }, context)).toThrow(
      expect.objectContaining({ kind: "conflict", message: expect.stringMatching(/only be archived/) })
    )
    const deleted = applyMenuCommand(state({ items: [item({ usedOnOrders: false })] }), { type: "delete_item", itemId: "item-1" }, context)
    expect(deleted.state.items).toHaveLength(0)
  })

  it("restores only into an active category", () => {
    const blocked = state({ items: [item({ archived: true })], categories: [category({ archived: true })] })
    expect(() => applyMenuCommand(blocked, { type: "restore_item", itemId: "item-1" }, context)).toThrow(
      expect.objectContaining({ kind: "conflict" })
    )
    const ok = applyMenuCommand(state({ items: [item({ archived: true })] }), { type: "restore_item", itemId: "item-1" }, context)
    expect(ok.result).toMatchObject({ item: { archived: false } })
  })
})

describe("categories", () => {
  it("creates a category at the end of the menu order", () => {
    const { result } = applyMenuCommand(state(), { type: "save_category", categoryId: null, draft: categoryDraft() }, context)
    expect(result).toMatchObject({ kind: "category", category: { name: "Snacks", position: 3, itemCount: 0 } })
  })

  it("refuses a duplicate name and renames items with their category", () => {
    expect(() =>
      applyMenuCommand(state(), { type: "save_category", categoryId: null, draft: categoryDraft({ name: "mains" }) }, context)
    ).toThrow(expect.objectContaining({ kind: "validation" }))
    const renamed = applyMenuCommand(
      state(),
      { type: "save_category", categoryId: "cat-mains", draft: categoryDraft({ name: "Main courses" }) },
      context
    )
    expect(renamed.state.items[0].categoryName).toBe("Main courses")
  })

  it("moves categories up and down, but not past the ends", () => {
    const moved = applyMenuCommand(state(), { type: "move_category", categoryId: "cat-drinks", direction: "up" }, context)
    const order = moved.state.categories.sort((a, b) => a.position - b.position).map((c) => c.id)
    expect(order).toEqual(["cat-drinks", "cat-mains"])
    expect(() => applyMenuCommand(state(), { type: "move_category", categoryId: "cat-mains", direction: "up" }, context)).toThrow(
      expect.objectContaining({ kind: "conflict", message: "This category is already first." })
    )
  })

  it("archives a category only once its items are moved or archived", () => {
    expect(() => applyMenuCommand(state(), { type: "archive_category", categoryId: "cat-mains" }, context)).toThrow(
      expect.objectContaining({ message: "Move or archive its 1 item first." })
    )
    const archived = applyMenuCommand(state(), { type: "archive_category", categoryId: "cat-drinks" }, context)
    expect(archived.result).toMatchObject({ category: { archived: true } })
  })

  it("deletes only categories with no items or order history", () => {
    expect(() => applyMenuCommand(state(), { type: "delete_category", categoryId: "cat-drinks" }, context)).toThrow(
      expect.objectContaining({ message: expect.stringMatching(/only be archived/) })
    )
    const fresh = state({ categories: [category(), category({ id: "cat-new", name: "New", usedOnOrders: false })] })
    expect(applyMenuCommand(fresh, { type: "delete_category", categoryId: "cat-new" }, context).state.categories).toHaveLength(1)
    // Archived items keep their last category (D7), so it can't be deleted.
    const withHistory = state({
      items: [item({ archived: true, categoryId: "cat-new" })],
      categories: [category({ id: "cat-new", usedOnOrders: false })],
    })
    expect(() => applyMenuCommand(withHistory, { type: "delete_category", categoryId: "cat-new" }, context)).toThrow(
      expect.objectContaining({ kind: "conflict" })
    )
  })
})

describe("itemStatus and displayPrice", () => {
  it("prefers archived, then category off, then sold out", () => {
    expect(itemStatus(item({ archived: true }), category({ active: false }))).toEqual({ kind: "archived" })
    expect(itemStatus(item({ soldOut: { until: "manual", reason: null, since: "", by: "" } }), category({ active: false }))).toEqual({
      kind: "category_off",
    })
    expect(itemStatus(item({ soldOut: { until: "end_of_day", reason: null, since: "", by: "" } }), category())).toEqual({
      kind: "sold_out",
      until: "end_of_day",
    })
  })

  it("lists order types the item or its category is off for", () => {
    expect(
      itemStatus(item({ channels: { ...ALL, dine_in: false } }), category({ channels: { ...ALL, delivery: false } }))
    ).toEqual({ kind: "available", offFor: ["delivery", "dine_in"] })
  })

  it("shows the cheapest size as a 'from' price", () => {
    const sized = item({
      sizes: [
        { id: "a", name: "Full", price: { amountMinor: 22000, currency: "INR" }, available: true },
        { id: "b", name: "Half", price: { amountMinor: 14000, currency: "INR" }, available: true },
      ],
    })
    expect(displayPrice(sized)).toEqual({ from: true, price: { amountMinor: 14000, currency: "INR" } })
    expect(displayPrice(item())).toEqual({ from: false, price: { amountMinor: 19000, currency: "INR" } })
  })
})
