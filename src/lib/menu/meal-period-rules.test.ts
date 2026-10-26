// @vitest-environment node
import { describe, expect, it } from "vitest"

import { emptyWeek } from "@/lib/hours/weekly-hours"

import type { MealPeriodDraft } from "./meal-periods"
import { applyMenuCommand, withUsage, type MenuState, type StoredCategory, type StoredMealPeriod } from "./rules"
import type { ItemSchedule } from "./schedule"
import { categoryDraft, itemDraft } from "./test-drafts"
import type { MenuItem } from "./types"

// Menu rules added in B3b: meal periods, their reference integrity, and
// category schedules. B2 rules are covered in rules.test.ts.

let counter = 0
const context = {
  now: new Date("2026-10-23T12:00:00.000Z"),
  actor: "Test staff",
  timeZone: "Asia/Kolkata",
  newId: (kind: string) => `new-${kind}-${++counter}`,
}
const ALL = { delivery: true, takeaway: true, dine_in: true }
const usesLunch: ItemSchedule = { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway"] }] }

function period(overrides: Partial<StoredMealPeriod> = {}): StoredMealPeriod {
  return {
    id: "meal-lunch",
    name: "Lunch",
    status: "active",
    weekly: [{ days: ["mon"], allDay: false, windows: [{ start: "12:00", end: "15:00" }] }],
    usedOnOrders: false,
    version: "meal-lunch-1",
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  }
}

function category(overrides: Partial<StoredCategory> = {}): StoredCategory {
  return {
    id: "cat-mains",
    name: "Mains",
    description: null,
    position: 1,
    active: true,
    channels: ALL,
    schedule: { mode: "always" },
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
  categories: [category()],
  mealPeriods: [period(), period({ id: "meal-dinner", name: "Dinner", version: "meal-dinner-1" })],
  ...overrides,
})

const days = (): MealPeriodDraft["days"] => ({
  ...emptyWeek(),
  tue: { enabled: true, allDay: false, windows: [{ key: "a", start: "12:00", end: "14:00" }, { key: "b", start: "13:30", end: "15:30" }] },
})

const run = (current: MenuState, command: Parameters<typeof applyMenuCommand>[1]) => applyMenuCommand(current, command, context)

describe("save_meal_period", () => {
  it("creates a period with merged times, no order types and no presets", () => {
    const { state: next, result } = run(state({ mealPeriods: [] }), {
      type: "save_meal_period",
      periodId: null,
      version: null,
      draft: { name: " Brunch ", days: days() },
    })
    if (result.kind !== "meal_period") throw new Error("expected a meal period")
    expect(result.period).toMatchObject({
      name: "Brunch",
      status: "active",
      weekly: [{ days: ["tue"], allDay: false, windows: [{ start: "12:00", end: "15:30" }] }],
      usage: { items: [], categories: [] },
      updatedBy: "Test staff",
    })
    expect(next.mealPeriods).toHaveLength(1)
  })

  it("refuses a name another active period has, ignoring case", () => {
    expect(() =>
      run(state(), { type: "save_meal_period", periodId: null, version: null, draft: { name: "lunch", days: days() } })
    ).toThrow(expect.objectContaining({ kind: "validation", fieldErrors: { "period.name": "Another meal period already has this name." } }))
  })

  it("changes the shared definition only: references keep their own order types", () => {
    const before = state({ items: [item({ schedule: usesLunch })] })
    const { state: next, result } = run(before, {
      type: "save_meal_period",
      periodId: "meal-lunch",
      version: "meal-lunch-1",
      draft: { name: "Lunch", days: days() },
    })
    if (result.kind !== "meal_period") throw new Error("expected a meal period")
    expect(result.period.version).toBe("meal-lunch-2")
    expect(result.period.usage.items).toEqual([{ id: "item-1", name: "Dal makhani", archived: false }])
    expect(next.items[0].schedule).toEqual(usesLunch)
    expect(next.items[0]).toEqual(before.items[0])
  })

  it("refuses an edit based on an older version, and edits to archived periods", () => {
    expect(() =>
      run(state(), { type: "save_meal_period", periodId: "meal-lunch", version: "meal-lunch-0", draft: { name: "Lunch", days: days() } })
    ).toThrow(expect.objectContaining({ kind: "conflict", userMessage: "Lunch was changed since you opened it. Reload to see the latest times." }))
    const archived = state({ mealPeriods: [period({ status: "archived" })] })
    expect(() =>
      run(archived, { type: "save_meal_period", periodId: "meal-lunch", version: "meal-lunch-1", draft: { name: "Lunch", days: days() } })
    ).toThrow(expect.objectContaining({ kind: "conflict" }))
  })
})

describe("archive, restore and delete meal periods", () => {
  it("refuses to archive a period an active item or category uses, naming how many", () => {
    const used = state({ items: [item({ schedule: usesLunch })], categories: [category({ schedule: usesLunch })] })
    expect(() => run(used, { type: "archive_meal_period", periodId: "meal-lunch" })).toThrow(
      expect.objectContaining({ kind: "conflict", userMessage: "Lunch is used by 1 item and 1 category. Change their schedules first." })
    )
  })

  it("archives once only archived items use it, then restores it", () => {
    const onlyArchived = state({ items: [item({ schedule: usesLunch, archived: true })] })
    const archived = run(onlyArchived, { type: "archive_meal_period", periodId: "meal-lunch" })
    expect(archived.state.mealPeriods[0].status).toBe("archived")
    const restored = run(archived.state, { type: "restore_meal_period", periodId: "meal-lunch" })
    expect(restored.state.mealPeriods[0].status).toBe("active")
  })

  it("refuses to restore when an active period now has the same name", () => {
    const clash = state({ mealPeriods: [period({ status: "archived" }), period({ id: "meal-new", name: "LUNCH" })] })
    expect(() => run(clash, { type: "restore_meal_period", periodId: "meal-lunch" })).toThrow(
      expect.objectContaining({ kind: "conflict", userMessage: "Another meal period is called Lunch. Rename it first." })
    )
  })

  it("deletes only a period nothing uses and that has no order history", () => {
    expect(run(state(), { type: "delete_meal_period", periodId: "meal-lunch" }).result).toEqual({
      kind: "meal_period_deleted",
      id: "meal-lunch",
      name: "Lunch",
    })
    const refusal = expect.objectContaining({ kind: "conflict", userMessage: "Lunch has been used, so it can only be archived." })
    expect(() => run(state({ mealPeriods: [period({ usedOnOrders: true })] }), { type: "delete_meal_period", periodId: "meal-lunch" })).toThrow(refusal)
    // Even an archived item still pointing at it blocks deletion.
    const archivedRef = state({ items: [item({ schedule: usesLunch, archived: true })] })
    expect(() => run(archivedRef, { type: "delete_meal_period", periodId: "meal-lunch" })).toThrow(refusal)
    expect(() => run(state(), { type: "delete_meal_period", periodId: "missing" })).toThrow(expect.objectContaining({ kind: "not_found" }))
  })

  it("reports usage including archived references", () => {
    const current = state({ items: [item({ schedule: usesLunch }), item({ id: "item-2", name: "Old", archived: true, schedule: usesLunch })] })
    expect(withUsage(current.mealPeriods[0], current).usage.items).toEqual([
      { id: "item-1", name: "Dal makhani", archived: false },
      { id: "item-2", name: "Old", archived: true },
    ])
  })
})

describe("reference integrity for items and categories", () => {
  const withLunch = itemDraft({ categoryId: "cat-mains", schedule: { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway"] }] } })

  it("saves an item that uses an active period", () => {
    const { result } = run(state(), { type: "save_item", itemId: "item-1", draft: withLunch })
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.schedule).toEqual({ mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway"] }] })
  })

  it("refuses unknown and archived periods with field errors", () => {
    const unknown = itemDraft({ categoryId: "cat-mains", schedule: { mode: "meal_periods", periods: [{ periodId: "gone", channels: ["takeaway"] }] } })
    expect(() => run(state(), { type: "save_item", itemId: null, draft: unknown })).toThrow(
      expect.objectContaining({ kind: "validation", fieldErrors: { "schedule.periods.gone": "This meal period no longer exists." } })
    )
    const archived = state({ mealPeriods: [period({ status: "archived" })] })
    expect(() => run(archived, { type: "save_category", categoryId: "cat-mains", draft: categoryDraft({ name: "Mains", schedule: withLunch.schedule }) })).toThrow(
      expect.objectContaining({ fieldErrors: { "schedule.periods.meal-lunch": "Lunch is archived. Choose another meal period or restore it." } })
    )
  })

  it("refuses to restore an item or category whose schedule uses an archived period", () => {
    const current = state({
      mealPeriods: [period({ status: "archived" })],
      items: [item({ archived: true, schedule: usesLunch })],
      categories: [category(), category({ id: "cat-old", name: "Old", archived: true, schedule: usesLunch })],
    })
    const refusal = expect.objectContaining({ kind: "conflict", userMessage: "Restore the Lunch meal period first." })
    expect(() => run(current, { type: "restore_item", itemId: "item-1" })).toThrow(refusal)
    expect(() => run(current, { type: "restore_category", categoryId: "cat-old" })).toThrow(refusal)
  })
})

describe("category schedules", () => {
  it("stores a custom category schedule stamped with the restaurant's zone", () => {
    const schedule = {
      mode: "custom" as const,
      days: {
        ...emptyWeek(),
        mon: { enabled: true, allDay: null, windows: [{ key: "w", start: "07:00", end: "11:00", channels: ["takeaway" as const] }] },
        tue: { enabled: false, allDay: null, windows: [] },
        wed: { enabled: false, allDay: null, windows: [] },
        thu: { enabled: false, allDay: null, windows: [] },
        fri: { enabled: false, allDay: null, windows: [] },
        sat: { enabled: false, allDay: null, windows: [] },
        sun: { enabled: false, allDay: null, windows: [] },
      },
    }
    const { result } = run(state(), { type: "save_category", categoryId: "cat-mains", draft: categoryDraft({ name: "Mains", schedule }) })
    if (result.kind !== "category") throw new Error("expected a category")
    expect(result.category.schedule).toEqual({
      mode: "custom",
      timeZone: "Asia/Kolkata",
      weekly: [{ days: ["mon"], allDay: null, windows: [{ start: "07:00", end: "11:00", channels: ["takeaway"] }] }],
    })
  })

  it("keeps the saved schedule when a save leaves it out, and new categories start always available", () => {
    const current = state({ categories: [category({ schedule: usesLunch })] })
    const { result } = run(current, { type: "save_category", categoryId: "cat-mains", draft: categoryDraft({ name: "Mains", active: false }) })
    if (result.kind !== "category") throw new Error("expected a category")
    expect(result.category.schedule).toEqual(usesLunch)
    expect(result.category.active).toBe(false)
    const created = run(state(), { type: "save_category", categoryId: null, draft: categoryDraft({ name: "Snacks" }) })
    if (created.result.kind !== "category") throw new Error("expected a category")
    expect(created.result.category.schedule).toEqual({ mode: "always" })
  })

  it("keeps the B2 save rule: an item may keep an order type its category has off", () => {
    const noDelivery = state({ categories: [category({ channels: { delivery: false, takeaway: true, dine_in: true } })] })
    const { result } = run(noDelivery, { type: "save_item", itemId: "item-1", draft: itemDraft({ categoryId: "cat-mains" }) })
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.channels.delivery).toBe(true)
  })
})
