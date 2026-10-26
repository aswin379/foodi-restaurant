// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { OrderType } from "@/lib/domain/order-types"
import type { DayRule } from "@/lib/hours/types"

import { checkAgainstHours, type HoursCheckInput } from "./hours-warnings"
import type { MealPeriod } from "./meal-periods"
import type { ItemSchedule } from "./schedule"

const TZ = "Asia/Kolkata"
const ALL_ON = { delivery: true, takeaway: true, dine_in: true }
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const
const EVERY_DAY = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

const rule = (days: readonly DayRule["days"][number][], windows: [string, string][], allDay = false): DayRule => ({
  days: [...days],
  allDay,
  windows: windows.map(([start, end]) => ({ start, end })),
})

// Every order type 11:00–22:00 on weekdays; delivery also late on Friday and Sunday overnight.
const hours = {
  timeZone: TZ,
  byOrderType: {
    delivery: [rule(WEEKDAYS, [["11:00", "22:00"]]), rule(["sun"], [["20:00", "01:00"]])],
    takeaway: [rule(WEEKDAYS, [["11:00", "22:00"]]), rule(["sat", "sun"], [], true)],
    dine_in: [rule(WEEKDAYS, [["11:00", "22:00"]])],
  } satisfies Record<OrderType, DayRule[]>,
}

const custom = (weekly: Extract<ItemSchedule, { mode: "custom" }>["weekly"], timeZone = TZ): ItemSchedule => ({ mode: "custom", timeZone, weekly })
const window = (start: string, end: string, channels: OrderType[]) => ({ start, end, channels })

function period(overrides: Partial<MealPeriod> = {}): MealPeriod {
  return {
    id: "meal-lunch",
    name: "Lunch",
    status: "active",
    weekly: [rule(WEEKDAYS, [["12:00", "15:00"]])],
    usage: { items: [], categories: [] },
    usedOnOrders: false,
    version: "1",
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  }
}

function input(overrides: Partial<HoursCheckInput> = {}): HoursCheckInput {
  return {
    timeZone: TZ,
    hours,
    item: { channels: ALL_ON, schedule: { mode: "always" } },
    category: { name: "Mains", channels: ALL_ON, schedule: { mode: "always" } },
    mealPeriods: [period()],
    ...overrides,
  }
}

describe("checkAgainstHours (advisory, weekly clock times only)", () => {
  it("finds nothing when the schedule is fully inside restaurant hours", () => {
    expect(checkAgainstHours(input({ item: { channels: ALL_ON, schedule: custom([{ days: ["mon"], allDay: null, windows: [window("12:00", "15:00", ["delivery", "takeaway", "dine_in"])] }]) } }))).toEqual({
      kind: "checked",
      neverOrderable: false,
      findings: [],
    })
    // Always available follows restaurant hours, so there's nothing to warn about.
    expect(checkAgainstHours(input())).toEqual({ kind: "checked", neverOrderable: false, findings: [] })
  })

  it("lists the times of a schedule that's partly outside hours, per order type", () => {
    const result = checkAgainstHours(
      input({ item: { channels: ALL_ON, schedule: custom([{ days: ["mon"], allDay: null, windows: [window("21:00", "23:30", ["delivery", "dine_in"])] }]) } })
    )
    expect(result).toEqual({
      kind: "checked",
      neverOrderable: false,
      findings: [
        { severity: "advisory", message: "Delivery: part of the schedule is outside delivery hours.", times: ["Mon 22:00–23:30"] },
        // Takeaway has no times in the schedule.
        { severity: "advisory", message: "Takeaway: the schedule has no times for takeaway.", times: [] },
        { severity: "advisory", message: "Dine-in: part of the schedule is outside dine-in hours.", times: ["Mon 22:00–23:30"] },
      ],
    })
  })

  it("gives the stronger warning when nothing overlaps restaurant hours", () => {
    const result = checkAgainstHours(
      input({ item: { channels: ALL_ON, schedule: custom([{ days: ["mon"], allDay: null, windows: [window("03:00", "04:00", ["delivery", "takeaway", "dine_in"])] }]) } })
    )
    if (result.kind !== "checked") throw new Error("expected a result")
    expect(result.neverOrderable).toBe(true)
    expect(result.findings[0]).toEqual({
      severity: "strong",
      message: "This item may never be orderable: its schedule leaves no time inside restaurant hours for any order type.",
      times: [],
    })
    expect(result.findings.slice(1).map((finding) => finding.message)).toEqual([
      "Delivery: the schedule is never within delivery hours.",
      "Takeaway: the schedule is never within takeaway hours.",
      "Dine-in: the schedule is never within dine-in hours.",
    ])
  })

  it("combines the category schedule with the item's, and says where the item goes beyond its category", () => {
    const result = checkAgainstHours(
      input({
        category: { name: "Breakfast", channels: ALL_ON, schedule: custom([{ days: ["mon"], allDay: null, windows: [window("11:00", "13:00", ["takeaway"])] }]) },
        item: { channels: ALL_ON, schedule: custom([{ days: ["mon"], allDay: null, windows: [window("12:00", "14:00", ["takeaway"])] }]) },
      })
    )
    if (result.kind !== "checked") throw new Error("expected a result")
    expect(result.neverOrderable).toBe(false)
    expect(result.findings).toContainEqual({
      severity: "advisory",
      message: "Takeaway: part of this item's schedule is outside the Breakfast category's schedule.",
      times: ["Mon 13:00–14:00"],
    })
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Delivery: this item's schedule and the Breakfast category's schedule never overlap."
    )
  })

  it("treats a category that has every one of the item's order types off as never orderable", () => {
    const result = checkAgainstHours(
      input({
        item: { channels: { delivery: true, takeaway: false, dine_in: false }, schedule: { mode: "always" } },
        category: { name: "Desserts", channels: { delivery: false, takeaway: true, dine_in: true }, schedule: { mode: "always" } },
      })
    )
    expect(result).toEqual({
      kind: "checked",
      neverOrderable: true,
      findings: [
        {
          severity: "strong",
          message: "This item may never be orderable: every order type it's offered for is off for the Desserts category.",
          times: [],
        },
      ],
    })
  })

  it("resolves meal periods per reference, with only the reference's order types", () => {
    const dinner = period({ id: "meal-dinner", name: "Dinner", weekly: [rule(EVERY_DAY, [["19:00", "23:00"]])] })
    const result = checkAgainstHours(
      input({
        mealPeriods: [period(), dinner],
        item: {
          channels: ALL_ON,
          schedule: { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway", "dine_in"] }, { periodId: "meal-dinner", channels: ["delivery"] }] },
        },
      })
    )
    if (result.kind !== "checked") throw new Error("expected a result")
    expect(result.findings).toEqual([
      // Weekdays 22:00–23:00 are past delivery hours; Saturday has none; Sunday's overnight hours start at 20:00.
      {
        severity: "advisory",
        message: "Delivery: part of the schedule is outside delivery hours.",
        times: ["Mon 22:00–23:00", "Tue 22:00–23:00", "Wed 22:00–23:00", "Thu 22:00–23:00", "and 3 more"],
      },
    ])
  })

  it("handles overnight windows that run from Sunday into Monday", () => {
    const result = checkAgainstHours(
      input({
        item: { channels: ALL_ON, schedule: custom([{ days: ["sun"], allDay: null, windows: [window("23:00", "02:00", ["delivery"])] }]) },
      })
    )
    if (result.kind !== "checked") throw new Error("expected a result")
    expect(result.findings[0]).toEqual({
      severity: "advisory",
      message: "Delivery: part of the schedule is outside delivery hours.",
      times: ["Mon 01:00–02:00"],
    })
  })

  it("says it can't evaluate instead of guessing", () => {
    const reasons = (overrides: Partial<HoursCheckInput>) => {
      const result = checkAgainstHours(input(overrides))
      return result.kind === "unresolved" ? result.reasons : null
    }
    expect(reasons({ hours: null })).toEqual(["Restaurant hours couldn't be loaded."])
    expect(reasons({ hours: null, hoursProblem: "Restaurant hours aren't connected yet." })).toEqual(["Restaurant hours aren't connected yet."])
    expect(reasons({ hours: { ...hours, timeZone: "Europe/London" } })).toEqual(["Restaurant hours use Europe/London, but the menu uses Asia/Kolkata."])
    expect(reasons({ category: null })).toEqual(["The item's category couldn't be found."])
    const lunch: ItemSchedule = { mode: "meal_periods", periods: [{ periodId: "meal-lunch", channels: ["takeaway"] }] }
    expect(reasons({ mealPeriods: null, item: { channels: ALL_ON, schedule: lunch } })).toEqual(["Meal periods couldn't be loaded."])
    expect(reasons({ mealPeriods: [], item: { channels: ALL_ON, schedule: lunch } })).toEqual([
      "A meal period used by this item's schedule wasn't found.",
    ])
    expect(reasons({ mealPeriods: [period({ status: "archived" })], category: { name: "Mains", channels: ALL_ON, schedule: lunch } })).toEqual([
      "Lunch, used by the Mains category's schedule, is archived.",
    ])
    expect(
      reasons({ category: { name: "Mains", channels: ALL_ON, schedule: custom([{ days: ["mon"], allDay: null, windows: [window("12:00", "13:00", ["takeaway"])] }], "Europe/London") } })
    ).toEqual(["The Mains category's schedule was saved for Europe/London, not Asia/Kolkata."])
    // Meal periods that can't load don't matter when nothing uses them.
    expect(checkAgainstHours(input({ mealPeriods: null })).kind).toBe("checked")
  })
})
