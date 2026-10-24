// @vitest-environment node
import { describe, expect, it } from "vitest"

import { emptyWeek } from "@/lib/hours/weekly-hours"

import {
  customDraftFromMealPeriods,
  mealPeriodDraftFrom,
  mealPeriodDraftFromInput,
  mealPeriodLines,
  usageText,
  validateMealPeriodDraft,
  weeklyFromDraft,
  type MealPeriod,
  type MealPeriodDraft,
} from "./meal-periods"
import {
  scheduleDraftFrom,
  scheduleDraftFromInput,
  scheduleFromDraft,
  scheduleLines,
  validateScheduleDraft,
  type ItemSchedule,
} from "./schedule"

const ALL_ON = { delivery: true, takeaway: true, dine_in: true }
const NO_DELIVERY = { delivery: false, takeaway: true, dine_in: true }

function period(overrides: Partial<MealPeriod> = {}): MealPeriod {
  return {
    id: "meal-lunch",
    name: "Lunch",
    status: "active",
    weekly: [{ days: ["mon", "tue"], allDay: false, windows: [{ start: "12:00", end: "15:00" }] }],
    usage: { items: [], categories: [] },
    usedOnOrders: false,
    version: "meal-lunch-1",
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  }
}

function draft(days: Partial<MealPeriodDraft["days"]>, name = "Lunch"): MealPeriodDraft {
  return { name, days: { ...emptyWeek(), ...days } }
}

describe("meal-period schedules (B3b)", () => {
  const schedule: ItemSchedule = {
    mode: "meal_periods",
    periods: [
      { periodId: "meal-lunch", channels: ["delivery", "takeaway", "dine_in"] },
      { periodId: "meal-dinner", channels: ["dine_in", "delivery"] },
    ],
  }

  it("round-trips through the editor draft and the parser, with order types canonical", () => {
    const fromEditor = scheduleDraftFrom(schedule)
    expect(fromEditor).toEqual({ mode: "meal_periods", periods: schedule.periods })
    expect(scheduleFromDraft(scheduleDraftFromInput(JSON.parse(JSON.stringify(fromEditor))), "Asia/Kolkata")).toEqual({
      mode: "meal_periods",
      periods: [
        { periodId: "meal-lunch", channels: ["delivery", "takeaway", "dine_in"] },
        { periodId: "meal-dinner", channels: ["delivery", "dine_in"] },
      ],
    })
  })

  it("needs a period, at most six, no repeats, and order types the owner offers", () => {
    expect(validateScheduleDraft({ mode: "meal_periods", periods: [] }, ALL_ON).schedule).toBe(
      "Choose a meal period, or make the item always available."
    )
    expect(validateScheduleDraft({ mode: "meal_periods", periods: [] }, ALL_ON, "category").schedule).toBe(
      "Choose a meal period, or make the category always available."
    )
    const many = Array.from({ length: 7 }, (_, index) => ({ periodId: `p${index}`, channels: ["takeaway" as const] }))
    expect(validateScheduleDraft({ mode: "meal_periods", periods: many }, ALL_ON).schedule).toBe("Use at most 6 meal periods.")
    const repeated = validateScheduleDraft(
      { mode: "meal_periods", periods: [{ periodId: "p", channels: ["takeaway"] }, { periodId: "p", channels: ["dine_in"] }] },
      ALL_ON
    )
    expect(repeated["schedule.periods.p"]).toBe("This meal period is already chosen.")
    // H1: a meal period never enables an order type its owner has off.
    const off = validateScheduleDraft({ mode: "meal_periods", periods: [{ periodId: "p", channels: ["delivery"] }] }, NO_DELIVERY, "category")
    expect(off["schedule.periods.p.channels"]).toBe(
      "Delivery is off for this category. Untick it here, or turn it on under Order types."
    )
    expect(validateScheduleDraft({ mode: "meal_periods", periods: [{ periodId: "p", channels: [] }] }, ALL_ON)["schedule.periods.p.channels"]).toBe(
      "Choose at least one order type."
    )
    expect(validateScheduleDraft({ mode: "meal_periods", periods: [{ periodId: "p", channels: ["takeaway"] }] }, NO_DELIVERY)).toEqual({})
  })

  it("names periods in schedule lines, and never guesses an unknown one", () => {
    const labels = new Map([
      ["meal-lunch", { name: "Lunch", archived: false }],
      ["meal-dinner", { name: "Dinner", archived: true }],
    ])
    expect(scheduleLines(schedule, ALL_ON, labels)).toEqual(["Lunch", "Dinner (archived; Delivery, Dine-in)"])
    expect(scheduleLines(schedule, ALL_ON)).toEqual(["Unknown meal period", "Unknown meal period (Delivery, Dine-in)"])
  })

  it("drops bad ids and unknown order types from untrusted input; other input stays 'always' as in B2", () => {
    expect(
      scheduleDraftFromInput({ mode: "meal_periods", periods: [{ periodId: "bad id!", channels: [] }, { periodId: "ok", channels: ["curbside", "takeaway"] }] })
    ).toEqual({ mode: "meal_periods", periods: [{ periodId: "ok", channels: ["takeaway"] }] })
    expect(scheduleDraftFromInput({ mode: "meal_periods" })).toEqual({ mode: "meal_periods", periods: [] })
    expect(scheduleDraftFromInput({ mode: "seasonal" })).toEqual({ mode: "always" })
    expect(scheduleDraftFromInput(undefined)).toEqual({ mode: "always" })
  })
})

describe("meal-period definitions", () => {
  it("validates the name and the times like restaurant hours", () => {
    expect(validateMealPeriodDraft(draft({}, " "))).toEqual({
      "period.name": "Enter the meal period name.",
      "period.days": "Choose at least one day.",
    })
    expect(validateMealPeriodDraft(draft({}, "x".repeat(41)))["period.name"]).toBe("Keep the name under 40 characters.")
    const errors = validateMealPeriodDraft(
      draft({
        mon: { enabled: true, allDay: false, windows: [] },
        tue: { enabled: true, allDay: true, windows: [{ key: "a", start: "12:00", end: "13:00" }] },
        wed: { enabled: true, allDay: false, windows: [{ key: "b", start: "12:00", end: "12:05" }, { key: "c", start: "", end: "13:00" }] },
      })
    )
    expect(errors["period.mon"]).toBe("Choose All day or add times for Monday, or switch the day off.")
    expect(errors["period.tue"]).toBe("Tuesday is already all day. Remove the times or turn off All day.")
    expect(errors["period.wed.b"]).toMatch(/15 minutes/)
    expect(errors["period.wed.c.start"]).toBe("Enter a start time.")
    expect(
      validateMealPeriodDraft(draft({ fri: { enabled: true, allDay: false, windows: [{ key: "d", start: "23:00", end: "02:00" }] } }))
    ).toEqual({})
  })

  it("merges windows, groups days and keeps overnight windows on their start day", () => {
    const weekly = weeklyFromDraft(
      draft({
        mon: { enabled: true, allDay: false, windows: [{ key: "a", start: "12:00", end: "14:00" }, { key: "b", start: "13:00", end: "15:00" }] },
        tue: { enabled: true, allDay: false, windows: [{ key: "c", start: "12:00", end: "15:00" }] },
        fri: { enabled: true, allDay: false, windows: [{ key: "d", start: "23:00", end: "02:00" }] },
        sun: { enabled: true, allDay: true, windows: [] },
      }).days
    )
    expect(mealPeriodLines(weekly)).toEqual(["Mon, Tue 12:00–15:00", "Fri 23:00–02:00 (+1 day)", "Sun All day"])
    // Back into the editor with position-based keys, so server and client agree.
    expect(mealPeriodDraftFrom({ name: "Lunch", weekly }).days.mon.windows).toEqual([{ key: "mon-1", start: "12:00", end: "15:00" }])
  })

  it("parses untrusted input into a well-typed draft", () => {
    expect(mealPeriodDraftFromInput({ name: 5, days: { mon: { enabled: true, allDay: "yes", windows: [{ key: "a", start: "12:00:00", end: "13:00" }] }, xyz: {} } })).toEqual(
      draft({ mon: { enabled: true, allDay: false, windows: [{ key: "a", start: "12:00", end: "13:00" }] } }, "")
    )
  })

  it("describes usage", () => {
    expect(usageText({ items: [1, 2], categories: [1] })).toBe("2 items and 1 category")
    expect(usageText({ items: [], categories: [] })).toBeNull()
  })
})

describe("Convert to custom times", () => {
  let counter = 0
  const newKey = () => `k${++counter}`

  it("copies each period's times with the reference's order types, so the effective schedule is unchanged", () => {
    const lunch = period()
    const dinner = period({ id: "meal-dinner", weekly: [{ days: ["mon"], allDay: false, windows: [{ start: "19:00", end: "23:00" }] }] })
    const result = customDraftFromMealPeriods(
      [
        { periodId: "meal-lunch", channels: ["takeaway", "dine_in"] },
        { periodId: "meal-dinner", channels: ["delivery"] },
      ],
      [lunch, dinner],
      newKey
    )
    if (!result.ok) throw new Error("expected a draft")
    expect(validateScheduleDraft(result.draft, ALL_ON)).toEqual({})
    expect(scheduleLines(scheduleFromDraft(result.draft, "Asia/Kolkata"), ALL_ON)).toEqual([
      "Mon 12:00–15:00 (Takeaway, Dine-in), 19:00–23:00 (Delivery)",
      "Tue 12:00–15:00 (Takeaway, Dine-in)",
    ])
    // The shared definitions aren't touched.
    expect(lunch.weekly).toEqual(period().weekly)
  })

  it("leaves out timed windows already covered by All day for the same order type", () => {
    const allDay = period({ id: "all", weekly: [{ days: ["sat"], allDay: true, windows: [] }] })
    const timed = period({ id: "timed", weekly: [{ days: ["sat"], allDay: false, windows: [{ start: "18:00", end: "22:00" }] }] })
    const result = customDraftFromMealPeriods(
      [
        { periodId: "all", channels: ["takeaway"] },
        { periodId: "timed", channels: ["takeaway", "delivery"] },
      ],
      [allDay, timed],
      newKey
    )
    if (!result.ok) throw new Error("expected a draft")
    expect(validateScheduleDraft(result.draft, ALL_ON)).toEqual({})
    expect(scheduleLines(scheduleFromDraft(result.draft, "Asia/Kolkata"), ALL_ON)).toEqual(["Sat All day (Takeaway), 18:00–22:00 (Delivery)"])
  })

  it("refuses to guess when a period is missing", () => {
    expect(customDraftFromMealPeriods([{ periodId: "gone", channels: ["takeaway"] }], [period()], newKey)).toEqual({
      ok: false,
      missing: ["gone"],
    })
  })
})
