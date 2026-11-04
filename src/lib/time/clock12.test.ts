import { describe, expect, it } from "vitest"

import { format12Hour, parseClockInput, to12Hour, to24Hour } from "./clock12"

describe("to24Hour", () => {
  it("maps the edge cases", () => {
    expect(to24Hour(12, "00", "AM")).toBe("00:00")
    expect(to24Hour(12, "00", "PM")).toBe("12:00")
    expect(to24Hour(11, "59", "PM")).toBe("23:59")
    expect(to24Hour(1, "00", "AM")).toBe("01:00")
    expect(to24Hour(1, "00", "PM")).toBe("13:00")
    expect(to24Hour(12, "30", "AM")).toBe("00:30")
  })
})

describe("to12Hour / format12Hour", () => {
  it("converts all 24 hours and round-trips", () => {
    for (let h = 0; h < 24; h++) {
      for (const m of ["00", "15", "59"]) {
        const value = `${String(h).padStart(2, "0")}:${m}`
        const clock = to12Hour(value)!
        expect(clock.hour).toBeGreaterThanOrEqual(1)
        expect(clock.hour).toBeLessThanOrEqual(12)
        expect(to24Hour(clock.hour, clock.minute, clock.period)).toBe(value)
      }
    }
  })

  it("formats for display", () => {
    expect(format12Hour("00:00")).toBe("12:00 AM")
    expect(format12Hour("12:00")).toBe("12:00 PM")
    expect(format12Hour("23:59")).toBe("11:59 PM")
    expect(format12Hour("18:00")).toBe("6:00 PM")
    expect(format12Hour("09:05")).toBe("9:05 AM")
  })

  it("leaves invalid values alone", () => {
    expect(to12Hour("")).toBeNull()
    expect(to12Hour("24:00")).toBeNull()
    expect(to12Hour("9:00")).toBeNull()
    expect(format12Hour("")).toBe("")
    expect(format12Hour("abc")).toBe("abc")
  })
})

describe("parseClockInput", () => {
  it("reads 12-hour input", () => {
    expect(parseClockInput("6:30 PM")).toBe("18:30")
    expect(parseClockInput("6pm")).toBe("18:00")
    expect(parseClockInput("06:30pm")).toBe("18:30")
    expect(parseClockInput("12 am")).toBe("00:00")
    expect(parseClockInput("12:00 PM")).toBe("12:00")
    expect(parseClockInput("11:59 PM")).toBe("23:59")
    expect(parseClockInput("9:05 a.m.")).toBe("09:05")
  })

  it("accepts an explicit 24-hour time", () => {
    expect(parseClockInput("18:30")).toBe("18:30")
    expect(parseClockInput("00:00")).toBe("00:00")
    expect(parseClockInput("23:59")).toBe("23:59")
  })

  it("rejects anything else", () => {
    for (const bad of ["", "6", "25:00", "13 pm", "0 am", "6:60 pm", "6:5 pm", "noon", "24:00"]) {
      expect(parseClockInput(bad)).toBeNull()
    }
  })
})
