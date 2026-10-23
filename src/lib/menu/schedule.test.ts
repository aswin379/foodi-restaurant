// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { OrderType } from "@/lib/domain/order-types"

import {
  emptyDays,
  formatDays,
  mergeDayWindows,
  mergeTimes,
  scheduleDraftFrom,
  scheduleDraftFromInput,
  scheduleFromDraft,
  scheduleLines,
  validateScheduleDraft,
  type DayDraft,
  type ScheduleDraft,
  type Weekday,
} from "./schedule"
import { itemDraft } from "./test-drafts"
import type { ChannelSettings } from "./types"
import { validateMenuItemDraft } from "./validation"

const ALL: OrderType[] = ["delivery", "takeaway", "dine_in"]
const ALL_ON: ChannelSettings = { delivery: true, takeaway: true, dine_in: true }
let counter = 0
const newKey = () => `k${++counter}`
type W = [start: string, end: string, channels?: OrderType[]]
const day = (...windows: W[]): DayDraft => ({
  enabled: true,
  allDay: null,
  windows: windows.map(([start, end, channels = ALL]) => ({ key: newKey(), start, end, channels })),
})
const allDay = (channels: OrderType[], ...windows: W[]): DayDraft => ({ ...day(...windows), allDay: { channels } })
const custom = (days: Partial<Record<Weekday, DayDraft>>): ScheduleDraft => ({
  mode: "custom",
  days: { ...emptyDays(), ...days },
})
const validate = (draft: ScheduleDraft, channels = ALL_ON) => validateScheduleDraft(draft, channels)
const windowKey = (draft: ScheduleDraft, weekday: Weekday, index = 0) =>
  draft.mode === "custom" ? draft.days[weekday].windows[index].key : ""

describe("validateScheduleDraft", () => {
  it("accepts always, and valid custom days", () => {
    expect(validate({ mode: "always" })).toEqual({})
    expect(validate(custom({ mon: day(["12:00", "15:00"], ["19:00", "23:00"]) }))).toEqual({})
  })

  it("needs at least one day", () => {
    expect(validate(custom({}))).toEqual({ schedule: "Choose at least one day, or make the item always available." })
    // A switched-off day doesn't count, even with windows.
    expect(validate(custom({ mon: { ...day(["12:00", "15:00"]), enabled: false } }))).toHaveProperty("schedule")
  })

  it("needs All day or a window on every chosen day", () => {
    expect(validate(custom({ tue: { enabled: true, allDay: null, windows: [] } }))).toEqual({
      "schedule.tue": "Choose All day or add a time window for Tuesday, or switch the day off.",
    })
  })

  it("reports missing times on the field, and window problems on the window", () => {
    const draft = custom({ mon: day(["", "12:00"], ["09:00", "09:00"], ["09:00", "09:10"]) })
    const errors = validate(draft)
    expect(errors[`schedule.mon.${windowKey(draft, "mon", 0)}.start`]).toBe("Enter a start time.")
    expect(errors[`schedule.mon.${windowKey(draft, "mon", 0)}.end`]).toBeUndefined()
    expect(errors[`schedule.mon.${windowKey(draft, "mon", 1)}`]).toBe("Start and end can't be the same time.")
    expect(errors[`schedule.mon.${windowKey(draft, "mon", 2)}`]).toMatch(/15 minutes/)
  })

  it("limits windows per day", () => {
    const many = day(...Array.from({ length: 7 }, (_, i): W => [`0${i}:00`, `0${i}:30`]))
    expect(validate(custom({ wed: many }))["schedule.wed"]).toBe("Use at most 6 windows a day.")
  })

  it("is part of item validation, against the item's order types", () => {
    expect(validateMenuItemDraft(itemDraft({ schedule: custom({}) }))).toHaveProperty("schedule")
    const delivery = custom({ mon: day(["18:00", "22:00", ["delivery"]]) })
    const noDelivery = { delivery: false, takeaway: true, dine_in: true }
    expect(validateMenuItemDraft(itemDraft({ schedule: delivery, channels: noDelivery }))).toEqual({
      [`schedule.mon.${windowKey(delivery, "mon")}.channels`]:
        "Delivery is off for this item. Untick it here, or turn it on under Order types.",
    })
  })
})

describe("order types per window (Q12)", () => {
  it("allows different order types on separate windows of the same day", () => {
    const draft = custom({ mon: day(["11:00", "15:00", ["dine_in", "takeaway"]], ["18:00", "22:00", ["delivery"]]) })
    expect(validate(draft)).toEqual({})
    expect(scheduleFromDraft(draft, "Asia/Kolkata")).toEqual({
      mode: "custom",
      timeZone: "Asia/Kolkata",
      weekly: [
        {
          days: ["mon"],
          allDay: null,
          windows: [
            { start: "11:00", end: "15:00", channels: ["takeaway", "dine_in"] },
            { start: "18:00", end: "22:00", channels: ["delivery"] },
          ],
        },
      ],
    })
  })

  it("allows several order types on one window", () => {
    const draft = custom({ fri: day(["12:00", "14:00", ["delivery", "takeaway"]]) })
    expect(validate(draft)).toEqual({})
    expect(scheduleLines(scheduleFromDraft(draft, "Asia/Kolkata"), ALL_ON)).toEqual(["Fri 12:00–14:00 (Delivery, Takeaway)"])
  })

  it("needs at least one order type on each window", () => {
    const draft = custom({ mon: day(["11:00", "15:00", []]) })
    expect(validate(draft)).toEqual({ [`schedule.mon.${windowKey(draft, "mon")}.channels`]: "Choose at least one order type." })
  })

  it("names every order type that's off for the item", () => {
    const draft = custom({ mon: day(["11:00", "15:00", ["delivery", "dine_in", "takeaway"]]) })
    const errors = validate(draft, { delivery: false, takeaway: true, dine_in: false })
    expect(errors[`schedule.mon.${windowKey(draft, "mon")}.channels`]).toBe(
      "Delivery and Dine-in are off for this item. Untick them here, or turn them on under Order types."
    )
  })
})

describe("All day (Q13)", () => {
  it("is valid on its own, keeps its order types, and isn't stored as times", () => {
    const draft = custom({ sat: allDay(["takeaway", "dine_in"]), sun: allDay(["takeaway", "dine_in"]) })
    expect(validate(draft)).toEqual({})
    const schedule = scheduleFromDraft(draft, "Asia/Kolkata")
    expect(schedule).toEqual({
      mode: "custom",
      timeZone: "Asia/Kolkata",
      weekly: [{ days: ["sat", "sun"], allDay: { channels: ["takeaway", "dine_in"] }, windows: [] }],
    })
    expect(JSON.stringify(schedule)).not.toMatch(/00:00|23:45|24:00/)
    expect(scheduleLines(schedule, ALL_ON)).toEqual(["Sat, Sun All day (Takeaway, Dine-in)"])
    // All the item's order types: no note needed.
    expect(scheduleLines(scheduleFromDraft(custom({ mon: allDay(ALL) }), "Asia/Kolkata"), ALL_ON)).toEqual(["Mon All day"])
  })

  it("can sit alongside timed windows for other order types", () => {
    const draft = custom({ sat: allDay(["takeaway", "dine_in"], ["18:00", "22:00", ["delivery"]]) })
    expect(validate(draft)).toEqual({})
    expect(scheduleLines(scheduleFromDraft(draft, "Asia/Kolkata"), ALL_ON)).toEqual([
      "Sat All day (Takeaway, Dine-in), 18:00–22:00 (Delivery)",
    ])
  })

  it("refuses a timed window for an order type that's already available all day", () => {
    const draft = custom({ sat: allDay(["takeaway", "dine_in"], ["18:00", "22:00", ["delivery", "takeaway"]]) })
    expect(validate(draft)).toEqual({
      [`schedule.sat.${windowKey(draft, "sat")}.channels`]:
        "Takeaway is already available all day on Saturday. Untick it here, or remove it from All day.",
    })
  })

  it("needs an order type the item is offered for", () => {
    expect(validate(custom({ mon: allDay([]) }))).toEqual({ "schedule.mon.allDay": "Choose at least one order type." })
    expect(validate(custom({ mon: allDay(["delivery"]) }), { delivery: false, takeaway: true, dine_in: true })).toEqual({
      "schedule.mon.allDay": "Delivery is off for this item. Untick it here, or turn it on under Order types.",
    })
  })
})

describe("merging (PRD §3.2)", () => {
  it("merges overlapping and touching times, in time order", () => {
    expect(
      mergeTimes([
        { start: "19:00", end: "23:00" },
        { start: "12:00", end: "15:00" },
        { start: "14:00", end: "16:00" },
        { start: "16:00", end: "17:00" },
      ])
    ).toEqual([
      { start: "12:00", end: "17:00" },
      { start: "19:00", end: "23:00" },
    ])
  })

  it("keeps an overnight window on its start day, without wrapping into the morning", () => {
    expect(
      mergeDayWindows([
        { start: "07:00", end: "11:00", channels: ALL },
        { start: "22:00", end: "02:00", channels: ALL },
      ])
    ).toEqual([
      { start: "07:00", end: "11:00", channels: ALL },
      { start: "22:00", end: "02:00", channels: ALL },
    ])
    expect(
      mergeDayWindows([
        { start: "20:00", end: "23:00", channels: ALL },
        { start: "22:00", end: "01:00", channels: ALL },
      ])
    ).toEqual([{ start: "20:00", end: "01:00", channels: ALL }])
  })

  it("merges per order type, so overlapping windows for different order types stay apart", () => {
    expect(
      mergeDayWindows([
        { start: "11:00", end: "15:00", channels: ["takeaway", "dine_in"] },
        { start: "14:00", end: "18:00", channels: ["delivery"] },
        { start: "14:00", end: "16:00", channels: ["takeaway"] },
      ])
    ).toEqual([
      { start: "11:00", end: "15:00", channels: ["dine_in"] },
      { start: "11:00", end: "16:00", channels: ["takeaway"] },
      { start: "14:00", end: "18:00", channels: ["delivery"] },
    ])
  })
})

describe("scheduleFromDraft", () => {
  it("returns always for always", () => {
    expect(scheduleFromDraft({ mode: "always" }, "Asia/Kolkata")).toEqual({ mode: "always" })
  })

  it("groups days with the same rule and stores the restaurant's zone", () => {
    const lunch = () => day(["12:00", "15:30"], ["19:00", "23:00"])
    const schedule = scheduleFromDraft(
      custom({ mon: lunch(), tue: lunch(), wed: lunch(), sat: day(["12:00", "23:30"]), sun: day(["12:00", "23:30"]) }),
      "Europe/London"
    )
    expect(schedule).toEqual({
      mode: "custom",
      timeZone: "Europe/London",
      weekly: [
        {
          days: ["mon", "tue", "wed"],
          allDay: null,
          windows: [
            { start: "12:00", end: "15:30", channels: ALL },
            { start: "19:00", end: "23:00", channels: ALL },
          ],
        },
        { days: ["sat", "sun"], allDay: null, windows: [{ start: "12:00", end: "23:30", channels: ALL }] },
      ],
    })
  })

  it("round-trips through the editor draft, including All day and order types", () => {
    const draft = custom({
      fri: day(["18:00", "02:00", ["delivery"]]),
      sat: allDay(["takeaway"], ["18:00", "22:00", ["delivery"]]),
      mon: { ...day(["09:00", "10:00"]), enabled: false },
    })
    const schedule = scheduleFromDraft(draft, "Asia/Kolkata")
    expect(schedule).toMatchObject({ weekly: [{ days: ["fri"] }, { days: ["sat"], allDay: { channels: ["takeaway"] } }] })
    const again = scheduleDraftFrom(schedule)
    expect(again).toMatchObject({
      days: {
        fri: { allDay: null, windows: [{ key: "fri-1", channels: ["delivery"] }] },
        sat: { allDay: { channels: ["takeaway"] }, windows: [{ key: "sat-1", start: "18:00", end: "22:00" }] },
        mon: { enabled: false },
      },
    })
    expect(scheduleFromDraft(again, "Asia/Kolkata")).toEqual(schedule)
    // And through the untrusted-input parser, as a save request would.
    expect(scheduleFromDraft(scheduleDraftFromInput(JSON.parse(JSON.stringify(again))), "Asia/Kolkata")).toEqual(schedule)
  })
})

describe("display", () => {
  it("formats days as ranges", () => {
    expect(formatDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Mon–Fri")
    expect(formatDays(["sat", "sun"])).toBe("Sat, Sun")
    expect(formatDays(["mon", "wed", "fri"])).toBe("Mon, Wed, Fri")
    expect(formatDays(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).toBe("Every day")
  })

  it("marks overnight windows, and order types only where they narrow the item's", () => {
    const schedule = scheduleFromDraft(
      custom({ fri: day(["18:00", "02:00"]), sat: day(["18:00", "02:00", ["delivery"]]) }),
      "Asia/Kolkata"
    )
    expect(scheduleLines(schedule, ALL_ON)).toEqual(["Fri 18:00–02:00 (+1 day)", "Sat 18:00–02:00 (+1 day; Delivery)"])
    // An item offered only for delivery needs no note on a delivery window.
    expect(scheduleLines(schedule, { delivery: true, takeaway: false, dine_in: false })[1]).toBe("Sat 18:00–02:00 (+1 day)")
  })
})

describe("scheduleDraftFromInput", () => {
  it("treats anything but a custom schedule as always", () => {
    expect(scheduleDraftFromInput(undefined)).toEqual({ mode: "always" })
    expect(scheduleDraftFromInput({ mode: "weird" })).toEqual({ mode: "always" })
  })

  it("keeps known days, order types and keys only, and trims time text", () => {
    const draft = scheduleDraftFromInput({
      mode: "custom",
      days: {
        mon: {
          enabled: true,
          windows: [
            { key: "ok-1", start: "12:00:00", end: "15:00", channels: ["dine_in", "pickup", "delivery", "delivery"] },
            { key: "<bad>", start: "1", end: "2", channels: ["delivery"] },
            { key: "allDay", start: "1", end: "2", channels: ["delivery"] },
            { key: "ok-2", start: "16:00", end: "17:00", channels: "delivery" },
          ],
        },
        tue: { enabled: "yes", allDay: { channels: ["takeaway", 7] }, windows: [] },
        wed: { enabled: true, allDay: true },
        funday: { enabled: true, windows: [] },
      },
    })
    if (draft.mode !== "custom") throw new Error("expected custom")
    expect(draft.days.mon).toEqual({
      enabled: true,
      allDay: null,
      windows: [
        { key: "ok-1", start: "12:00", end: "15:00", channels: ["delivery", "dine_in"] },
        { key: "ok-2", start: "16:00", end: "17:00", channels: [] },
      ],
    })
    expect(draft.days.tue).toEqual({ enabled: false, allDay: { channels: ["takeaway"] }, windows: [] })
    // All day must be an object with order types; `true` isn't enough.
    expect(draft.days.wed.allDay).toBeNull()
    expect(Object.keys(draft.days)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
  })
})
