// @vitest-environment node
import { describe, expect, it } from "vitest"

import { coveredBy, formatDays, mergeDayWindows, mergeTimes, nextWeekday, previousWeekday } from "./weekly"

describe("shared weekly helpers", () => {
  it("merges overlapping and touching windows in time order", () => {
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

  it("keeps an overnight window on its start day and never wraps into the morning", () => {
    expect(mergeTimes([{ start: "07:00", end: "11:00" }, { start: "22:00", end: "02:00" }])).toEqual([
      { start: "07:00", end: "11:00" },
      { start: "22:00", end: "02:00" },
    ])
    expect(mergeTimes([{ start: "20:00", end: "23:00" }, { start: "22:00", end: "01:00" }])).toEqual([{ start: "20:00", end: "01:00" }])
  })

  it("caps merged overnight windows below a full day", () => {
    expect(mergeTimes([{ start: "10:00", end: "09:00" }, { start: "20:00", end: "12:00" }])).toEqual([{ start: "10:00", end: "09:59" }])
  })

  it("ignores invalid windows", () => {
    expect(mergeTimes([{ start: "09:00", end: "09:00" }, { start: "", end: "10:00" }])).toEqual([])
  })

  it("merges per order type", () => {
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

  it("reports order types an All day entry already covers", () => {
    expect(coveredBy(["takeaway", "dine_in"], ["delivery", "takeaway"])).toEqual(["takeaway"])
    expect(coveredBy(["takeaway"], ["delivery"])).toEqual([])
  })

  it("wraps Sunday into Monday for overnight windows", () => {
    expect(nextWeekday("sun")).toBe("mon")
    expect(previousWeekday("mon")).toBe("sun")
  })

  it("formats days as ranges", () => {
    expect(formatDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Mon–Fri")
    expect(formatDays(["sat", "sun"])).toBe("Sat, Sun")
    expect(formatDays(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).toBe("Every day")
  })
})
