// @vitest-environment node
import { describe, expect, it } from "vitest"

import { formatInstant, isValidTimeZone, localDateOf } from "./format"
import {
  formatLocalTime,
  isOvernight,
  mergeWindows,
  nominalWindowMinutes,
  parseLocalTime,
  validateWindow,
} from "./windows"

const london = { timeZone: "Europe/London", locale: "en-GB" }

describe("formatInstant", () => {
  it("uses the restaurant's zone, not a fixed offset, across a DST change", () => {
    // Europe/London springs forward at 01:00 UTC on 29 March 2026.
    expect(formatInstant("2026-03-29T00:30:00Z", london, "time")).toBe("0:30")
    expect(formatInstant("2026-03-29T01:30:00Z", london, "time")).toBe("2:30")
    // ...and falls back at 01:00 UTC on 25 October 2026.
    expect(formatInstant("2026-10-25T00:30:00Z", london, "time")).toBe("1:30")
    expect(formatInstant("2026-10-25T01:30:00Z", london, "time")).toBe("1:30")
  })

  it("formats Asia/Kolkata (no DST) at +05:30", () => {
    const kolkata = { timeZone: "Asia/Kolkata", locale: "en-GB" }
    expect(formatInstant("2026-10-23T18:45:00Z", kolkata, "time")).toBe("0:15")
    expect(localDateOf("2026-10-23T18:45:00Z", "Asia/Kolkata")).toBe("2026-10-24")
  })

  it("checks zone names", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true)
    expect(isValidTimeZone("Mars/Olympus")).toBe(false)
  })
})

describe("local times", () => {
  it("parses and formats HH:MM", () => {
    expect(parseLocalTime("07:05")).toBe(425)
    expect(parseLocalTime("23:59")).toBe(1439)
    for (const bad of ["24:00", "7:05", "07:60", "", "noon"]) {
      expect(parseLocalTime(bad)).toBeNull()
    }
    expect(formatLocalTime(425)).toBe("07:05")
    expect(formatLocalTime(1440 + 60)).toBe("01:00")
  })
})

describe("windows", () => {
  it("treats an end before the start as overnight", () => {
    expect(isOvernight({ start: "22:00", end: "02:00" })).toBe(true)
    expect(isOvernight({ start: "12:00", end: "15:30" })).toBe(false)
    expect(nominalWindowMinutes({ start: "22:00", end: "02:00" })).toBe(240)
  })

  it("validates format, empty and minimum length", () => {
    expect(validateWindow({ start: "12:00", end: "15:30" })).toBeNull()
    expect(validateWindow({ start: "23:50", end: "00:05" })).toBeNull()
    expect(validateWindow({ start: "12:00", end: "12:00" })).toBe("empty")
    expect(validateWindow({ start: "12:00", end: "12:10" })).toBe("too_short")
    expect(validateWindow({ start: "12", end: "13:00" })).toBe("invalid_time")
  })

  it("merges overlapping and touching windows", () => {
    expect(
      mergeWindows([
        { start: "19:00", end: "23:00" },
        { start: "12:00", end: "15:00" },
        { start: "14:30", end: "16:00" },
        { start: "16:00", end: "17:00" },
      ])
    ).toEqual({
      windows: [
        { start: "12:00", end: "17:00" },
        { start: "19:00", end: "23:00" },
      ],
      coversWholeDay: false,
    })
  })

  it("merges an overnight window with an early window it wraps into", () => {
    expect(
      mergeWindows([
        { start: "22:00", end: "02:00" },
        { start: "01:00", end: "03:00" },
        { start: "12:00", end: "15:00" },
      ])
    ).toEqual({
      windows: [
        { start: "12:00", end: "15:00" },
        { start: "22:00", end: "03:00" },
      ],
      coversWholeDay: false,
    })
  })

  it("reports windows that cover a whole day", () => {
    expect(
      mergeWindows([
        { start: "10:00", end: "09:00" },
        { start: "08:00", end: "12:00" },
      ])
    ).toEqual({ windows: [], coversWholeDay: true })
  })

  it("ignores invalid windows", () => {
    expect(mergeWindows([{ start: "bad", end: "12:00" }])).toEqual({ windows: [], coversWholeDay: false })
  })
})
