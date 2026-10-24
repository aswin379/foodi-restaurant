// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  copyDayTo,
  copyToAllDays,
  emptyHoursDraft,
  hoursDraftFrom,
  hoursDraftFromInput,
  hoursFromDraft,
  hoursLines,
  hoursWarnings,
  sameAs,
  validateHoursDraft,
  type HoursDraft,
} from "./weekly-hours"

let counter = 0
const newKey = () => `k${++counter}`
const open = (...windows: Array<[string, string]>) => ({
  enabled: true,
  allDay: false,
  windows: windows.map(([start, end]) => ({ key: newKey(), start, end })),
})

function draftWith(patch: (draft: HoursDraft) => void) {
  const draft = emptyHoursDraft()
  patch(draft)
  return draft
}

describe("validateHoursDraft", () => {
  it("accepts several windows, overnight windows and All day", () => {
    const draft = draftWith((d) => {
      d.delivery.fri = open(["11:00", "15:00"], ["18:00", "02:00"])
      d.takeaway.sat = { enabled: true, allDay: true, windows: [] }
    })
    expect(validateHoursDraft(draft)).toEqual({})
  })

  it("needs All day or a window on an open day", () => {
    const draft = draftWith((d) => {
      d.dine_in.mon = { enabled: true, allDay: false, windows: [] }
    })
    expect(validateHoursDraft(draft)).toEqual({
      "hours.dine_in.mon": "Choose All day or add opening hours for Dine-in on Monday, or switch the day off.",
    })
  })

  it("refuses All day plus a timed window for the same order type and day (H2)", () => {
    const draft = draftWith((d) => {
      d.takeaway.sun = { enabled: true, allDay: true, windows: [{ key: "w1", start: "10:00", end: "12:00" }] }
    })
    expect(validateHoursDraft(draft)).toEqual({
      "hours.takeaway.sun": "Takeaway is already open all day on Sunday. Remove the time windows or turn off All day.",
    })
  })

  it("reports missing and too-short times on the field or window", () => {
    const draft = draftWith((d) => {
      d.delivery.tue = {
        enabled: true,
        allDay: false,
        windows: [
          { key: "a", start: "", end: "12:00" },
          { key: "b", start: "09:00", end: "09:10" },
        ],
      }
    })
    expect(validateHoursDraft(draft)).toEqual({
      "hours.delivery.tue.a.start": "Enter a start time.",
      "hours.delivery.tue.b": "A window must be at least 15 minutes long.",
    })
  })

  it("limits windows per day", () => {
    const draft = draftWith((d) => {
      d.delivery.wed = open(...Array.from({ length: 7 }, (_, i): [string, string] => [`0${i}:00`, `0${i}:30`]))
    })
    expect(validateHoursDraft(draft)["hours.delivery.wed"]).toBe("Use at most 6 windows a day.")
  })

  it("warns, without blocking, when an order type is closed every day", () => {
    const draft = draftWith((d) => {
      d.delivery.mon = open(["11:00", "15:00"])
    })
    expect(hoursWarnings(draft)).toEqual(["Takeaway is closed every day.", "Dine-in is closed every day."])
    expect(validateHoursDraft(draft)).toEqual({})
  })
})

describe("hoursFromDraft", () => {
  it("merges overlaps, groups days with the same hours and keeps All day separate from windows", () => {
    const draft = draftWith((d) => {
      d.delivery.mon = open(["11:00", "15:00"], ["14:00", "16:00"])
      d.delivery.tue = open(["11:00", "16:00"])
      d.delivery.fri = open(["18:00", "02:00"])
      d.takeaway.sat = { enabled: true, allDay: true, windows: [] }
      d.takeaway.sun = { enabled: true, allDay: true, windows: [] }
    })
    const rules = hoursFromDraft(draft)
    expect(rules.delivery).toEqual([
      { days: ["mon", "tue"], allDay: false, windows: [{ start: "11:00", end: "16:00" }] },
      { days: ["fri"], allDay: false, windows: [{ start: "18:00", end: "02:00" }] },
    ])
    expect(rules.takeaway).toEqual([{ days: ["sat", "sun"], allDay: true, windows: [] }])
    expect(JSON.stringify(rules.takeaway)).not.toMatch(/00:00|23:45/)
    expect(rules.dine_in).toEqual([])
    expect(hoursLines(rules.delivery)).toEqual(["Mon, Tue 11:00–16:00", "Fri 18:00–02:00 (+1 day)"])
    expect(hoursLines(rules.takeaway)).toEqual(["Sat, Sun All day"])
  })

  it("round-trips through the editor draft and untrusted input", () => {
    const rules = hoursFromDraft(
      draftWith((d) => {
        d.delivery.sun = open(["22:00", "01:00"])
        d.dine_in.mon = { enabled: true, allDay: true, windows: [] }
      })
    )
    const again = hoursDraftFrom({ byOrderType: rules })
    expect(hoursFromDraft(again)).toEqual(rules)
    expect(hoursFromDraft(hoursDraftFromInput(JSON.parse(JSON.stringify(again))))).toEqual(rules)
  })
})

describe("copy helpers", () => {
  it("copies a day to chosen days, or to every day, within one order type", () => {
    const draft = draftWith((d) => {
      d.delivery.mon = open(["11:00", "15:00"], ["", ""])
    })
    const copied = copyDayTo(draft, "delivery", "mon", ["tue", "wed"], newKey)
    expect(copied.delivery.tue.windows.map(({ start, end }) => [start, end])).toEqual([["11:00", "15:00"]])
    expect(copied.delivery.thu.enabled).toBe(false)
    expect(copied.takeaway.tue.enabled).toBe(false)
    const everyDay = copyToAllDays(draft, "delivery", "mon", newKey)
    expect(Object.values(everyDay.delivery).every((day) => day.enabled)).toBe(true)
  })

  it("Same as delivery replaces the whole week of another order type", () => {
    const draft = draftWith((d) => {
      d.delivery.fri = open(["18:00", "02:00"])
      d.takeaway.mon = open(["09:00", "10:00"])
    })
    const same = sameAs(draft, "takeaway", "delivery", newKey)
    expect(hoursFromDraft(same).takeaway).toEqual(hoursFromDraft(same).delivery)
    expect(same.takeaway.mon.enabled).toBe(false)
  })
})

describe("hoursDraftFromInput", () => {
  it("drops unknown order types, days and bad keys", () => {
    const draft = hoursDraftFromInput({
      pickup: { mon: { enabled: true, allDay: true } },
      delivery: { mon: { enabled: true, windows: [{ key: "<x>", start: "10:00", end: "11:00" }, { key: "ok", start: "10:00:00", end: "11:00" }] }, funday: {} },
    })
    expect(draft.delivery.mon).toEqual({ enabled: true, allDay: false, windows: [{ key: "ok", start: "10:00", end: "11:00" }] })
    expect(Object.keys(draft)).toEqual(["delivery", "takeaway", "dine_in"])
  })
})
