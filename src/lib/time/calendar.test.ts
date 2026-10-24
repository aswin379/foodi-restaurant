// @vitest-environment node
import { describe, expect, it } from "vitest"

import { addDays, isCalendarDate, localClock, localDayHours, offsetMinutes, startOfLocalDay, weekdayOf } from "./calendar"

describe("calendar dates in a restaurant zone", () => {
  it("validates and steps calendar dates", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false)
    expect(isCalendarDate("2028-02-29")).toBe(true)
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(weekdayOf("2026-10-25")).toBe("sun")
  })

  it("reads the local clock in the restaurant's zone, not the device's", () => {
    const instant = new Date("2026-10-24T20:30:00Z")
    expect(localClock(instant, "Asia/Kolkata")).toEqual({ date: "2026-10-25", weekday: "sun", minutes: 2 * 60 })
    expect(localClock(instant, "Europe/London")).toEqual({ date: "2026-10-24", weekday: "sat", minutes: 21 * 60 + 30 })
    expect(offsetMinutes(instant.getTime(), "Asia/Kolkata")).toBe(330)
  })

  it("finds local midnight across daylight-saving changes", () => {
    // London: BST (+01:00) until 25 Oct 2026, then GMT.
    expect(startOfLocalDay("2026-10-25", "Europe/London").toISOString()).toBe("2026-10-24T23:00:00.000Z")
    expect(startOfLocalDay("2026-10-26", "Europe/London").toISOString()).toBe("2026-10-26T00:00:00.000Z")
    expect(startOfLocalDay("2026-10-25", "Asia/Kolkata").toISOString()).toBe("2026-10-24T18:30:00.000Z")
  })

  it("knows a DST day is 23 or 25 hours", () => {
    expect(localDayHours("2026-10-25", "Europe/London")).toBe(25)
    expect(localDayHours("2026-03-29", "Europe/London")).toBe(23)
    expect(localDayHours("2026-10-25", "Asia/Kolkata")).toBe(24)
  })
})
