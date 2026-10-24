// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  overnightIntoDate,
  specialDateFields,
  specialDateSummary,
  validateSpecialDateDraft,
  type SpecialDateDraft,
} from "./special-dates"
import type { SpecialDate, WeeklyHours } from "./types"

const today = "2026-10-24"
const staff = { kind: "staff" as const, staff: { id: "s", name: "Owner" } }
const existing = (overrides: Partial<SpecialDate> = {}): SpecialDate => ({
  id: "spd-1",
  date: "2026-11-08",
  orderTypes: ["takeaway"],
  kind: "closed",
  allDay: false,
  windows: [],
  note: null,
  editable: true,
  version: "spd-1-1",
  createdAt: "",
  createdBy: staff,
  updatedAt: "",
  updatedBy: staff,
  ...overrides,
})
const draft = (overrides: Partial<SpecialDateDraft> = {}): SpecialDateDraft => ({
  date: "2026-11-08",
  orderTypes: ["delivery"],
  kind: "closed",
  allDay: false,
  windows: [],
  note: "",
  ...overrides,
})
const validate = (value: SpecialDateDraft, others: SpecialDate[] = []) => validateSpecialDateDraft(value, { today, others })

describe("validateSpecialDateDraft (H3)", () => {
  it("accepts a closed date or special hours for one or several order types", () => {
    expect(validate(draft())).toEqual({})
    expect(
      validate(draft({ orderTypes: ["delivery", "dine_in"], kind: "special_hours", windows: [{ key: "w", start: "17:00", end: "01:00" }] }))
    ).toEqual({})
    expect(validate(draft({ date: today }))).toEqual({})
  })

  it("refuses past dates, missing dates and no order types", () => {
    expect(validate(draft({ date: "2026-10-23" }))).toEqual({ "specialDate.date": "Choose today or a later date." })
    expect(validate(draft({ date: "2026-02-30" }))).toEqual({ "specialDate.date": "Choose a date." })
    expect(validate(draft({ orderTypes: [] }))).toEqual({ "specialDate.orderTypes": "Choose at least one order type." })
  })

  it("allows one special date per date and order type", () => {
    expect(validate(draft({ orderTypes: ["delivery", "takeaway"] }), [existing()])).toEqual({
      "specialDate.orderTypes": "Takeaway already has a special date on Sun, 8 Nov.",
    })
    // Another order type on the same date, or the same type on another date, is fine.
    expect(validate(draft(), [existing()])).toEqual({})
    expect(validate(draft({ orderTypes: ["takeaway"], date: "2026-11-09" }), [existing()])).toEqual({})
  })

  it("needs hours for special hours, and doesn't allow All day plus windows", () => {
    expect(validate(draft({ kind: "special_hours" }))).toEqual({
      "specialDate.hours": "Choose All day or add opening hours, or mark the date as closed.",
    })
    expect(validate(draft({ kind: "special_hours", allDay: true, windows: [{ key: "w", start: "10:00", end: "11:00" }] }))).toEqual({
      "specialDate.hours": "All day is already chosen. Remove the time windows or turn off All day.",
    })
    expect(validate(draft({ kind: "special_hours", windows: [{ key: "w", start: "10:00", end: "10:05" }] }))).toEqual({
      "specialDate.windows.w": "A window must be at least 15 minutes long.",
    })
  })

  it("stores closed dates without hours, and merges special-hours windows", () => {
    expect(specialDateFields(draft({ windows: [{ key: "w", start: "10:00", end: "11:00" }] }))).toMatchObject({ windows: [], allDay: false })
    const fields = specialDateFields(
      draft({
        kind: "special_hours",
        orderTypes: ["dine_in", "delivery"],
        windows: [
          { key: "a", start: "12:00", end: "15:00" },
          { key: "b", start: "14:00", end: "16:00" },
        ],
        note: "  Diwali ",
      })
    )
    expect(fields).toEqual({
      date: "2026-11-08",
      orderTypes: ["delivery", "dine_in"],
      kind: "special_hours",
      allDay: false,
      windows: [{ start: "12:00", end: "16:00" }],
      note: "Diwali",
    })
    expect(specialDateSummary(fields)).toBe("Open 12:00–16:00")
  })
})

describe("overnightIntoDate (H4 detection only)", () => {
  const weekly: Pick<WeeklyHours, "byOrderType"> = {
    byOrderType: {
      delivery: [{ days: ["fri"], allDay: false, windows: [{ start: "11:00", end: "15:00" }, { start: "18:00", end: "02:00" }] }],
      takeaway: [{ days: ["fri"], allDay: true, windows: [] }],
      dine_in: [],
    },
  }

  it("finds the previous day's overnight windows for the affected order types only", () => {
    // 2026-10-31 is a Saturday.
    expect(overnightIntoDate("2026-10-31", ["delivery", "takeaway"], weekly, [])).toEqual([
      { type: "delivery", window: { start: "18:00", end: "02:00" }, from: "weekly" },
    ])
    expect(overnightIntoDate("2026-10-31", ["dine_in"], weekly, [])).toEqual([])
    expect(overnightIntoDate("2026-11-01", ["delivery"], weekly, [])).toEqual([])
  })

  it("uses a special date on the previous day instead of its weekly hours", () => {
    const closedFriday = existing({ date: "2026-10-30", orderTypes: ["delivery"], kind: "closed" })
    expect(overnightIntoDate("2026-10-31", ["delivery"], weekly, [closedFriday])).toEqual([])
    const lateFriday = existing({ date: "2026-10-30", orderTypes: ["delivery"], kind: "special_hours", windows: [{ start: "20:00", end: "03:00" }] })
    expect(overnightIntoDate("2026-10-31", ["delivery"], weekly, [lateFriday])).toEqual([
      { type: "delivery", window: { start: "20:00", end: "03:00" }, from: "special_date" },
    ])
  })
})
