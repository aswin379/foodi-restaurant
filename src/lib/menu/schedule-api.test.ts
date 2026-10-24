// @vitest-environment node
import { describe, expect, it } from "vitest"

import { emptyDays, type ItemSchedule } from "./schedule"
import { scheduleDraftToApi, scheduleFromApi, scheduleToApi } from "./schedule-api"

const ALL_ON = { delivery: true, takeaway: true, dine_in: true }

const schedule: ItemSchedule = {
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
    { days: ["sat", "sun"], allDay: { channels: ["takeaway", "dine_in"] }, windows: [] },
  ],
}

describe("item schedule wire mapping", () => {
  it("round-trips per-window order types and All day", () => {
    expect(scheduleFromApi(scheduleToApi(schedule), ALL_ON)).toEqual(schedule)
    expect(scheduleFromApi(undefined, ALL_ON)).toEqual({ mode: "always" })
  })

  it("reads windows without order types (PRD §3.2 before Q12) as all of the item's order types", () => {
    const legacy = { mode: "custom", timeZone: "Asia/Kolkata", weekly: [{ days: ["fri"], windows: [{ start: "18:00", end: "02:00" }] }] }
    expect(scheduleFromApi(legacy, { delivery: false, takeaway: true, dine_in: true })).toEqual({
      mode: "custom",
      timeZone: "Asia/Kolkata",
      weekly: [{ days: ["fri"], allDay: null, windows: [{ start: "18:00", end: "02:00", channels: ["takeaway", "dine_in"] }] }],
    })
    // Schedule-level channels, where sent, apply to every window.
    expect(scheduleFromApi({ ...legacy, channels: ["delivery"] }, ALL_ON)).toMatchObject({
      weekly: [{ windows: [{ channels: ["delivery"] }] }],
    })
  })

  it("refuses unknown order types and malformed schedules instead of guessing", () => {
    const withUnknown = { mode: "custom", timeZone: "Asia/Kolkata", weekly: [{ days: ["mon"], windows: [{ start: "11:00", end: "15:00", channels: ["pickup"] }] }] }
    expect(() => scheduleFromApi(withUnknown, ALL_ON)).toThrow(expect.objectContaining({ kind: "unavailable" }))
    expect(() => scheduleFromApi({ mode: "custom", timeZone: "Asia/Kolkata", weekly: [{ days: ["funday"], windows: [] }] }, ALL_ON)).toThrow(
      expect.objectContaining({ kind: "unavailable" })
    )
  })

  it("sends a save draft's order types in API names", () => {
    const draft = {
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
    expect(scheduleDraftToApi(draft)).toMatchObject({
      days: { sat: { enabled: true, allDay: { channels: ["takeaway"] }, windows: [{ key: "new-a", channels: ["delivery"] }] } },
    })
  })
})
