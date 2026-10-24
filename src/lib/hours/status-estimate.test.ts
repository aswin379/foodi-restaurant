// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { HoursState } from "./rules"
import { estimateStatus } from "./status-estimate"
import type { SpecialDate } from "./types"

const staff = { kind: "staff" as const, staff: { id: "s", name: "Owner" } }
const special = (overrides: Partial<SpecialDate>): SpecialDate => ({
  id: "x",
  date: "2026-10-31",
  orderTypes: ["delivery"],
  kind: "closed",
  allDay: false,
  windows: [],
  note: null,
  editable: true,
  version: "x-1",
  createdAt: "",
  createdBy: staff,
  updatedAt: "",
  updatedBy: staff,
  ...overrides,
})

const state = (specialDates: SpecialDate[] = [], pause: HoursState["pause"] = { paused: false, lastResumedAt: null, lastResumedBy: null }): HoursState => ({
  weekly: {
    timeZone: "Asia/Kolkata",
    byOrderType: {
      // Friday 18:00–02:00 runs into Saturday.
      delivery: [{ days: ["fri", "sat"], allDay: false, windows: [{ start: "11:00", end: "15:00" }, { start: "18:00", end: "02:00" }] }],
      takeaway: [{ days: ["sat", "sun"], allDay: true, windows: [] }],
      dine_in: [],
    },
    version: "h-1",
    updatedAt: null,
    updatedBy: null,
  },
  specialDates,
  pause,
})

// Kolkata is UTC+05:30. Saturday 31 Oct 2026:
const SAT_0100 = new Date("2026-10-30T19:30:00Z")
const SAT_1200 = new Date("2026-10-31T06:30:00Z")
const SAT_1600 = new Date("2026-10-31T10:30:00Z")

describe("preview status estimate", () => {
  it("is labelled an estimate and never claims anything about scheduled orders (P-2)", () => {
    const status = estimateStatus(state(), SAT_1200, "Asia/Kolkata")
    expect(status.source).toBe("preview_estimate")
    expect(Object.values(status.byOrderType).map((type) => type.scheduled)).toEqual([null, null, null])
  })

  it("reports each order type's immediate state and reason", () => {
    const status = estimateStatus(state(), SAT_1200, "Asia/Kolkata")
    expect(status.byOrderType.delivery.immediate).toMatchObject({ state: "open", reason: "weekly_hours" })
    expect(status.byOrderType.takeaway.immediate).toMatchObject({ state: "open", reason: "all_day" })
    expect(status.byOrderType.dine_in.immediate).toMatchObject({ state: "closed", reason: "no_hours_set" })
    expect(estimateStatus(state(), SAT_1600, "Asia/Kolkata").byOrderType.delivery.immediate).toMatchObject({
      state: "closed",
      reason: "weekly_hours",
    })
  })

  it("keeps the previous day's overnight window running past midnight", () => {
    expect(estimateStatus(state(), SAT_0100, "Asia/Kolkata").byOrderType.delivery.immediate).toMatchObject({
      state: "open",
      reason: "weekly_hours",
    })
  })

  it("marks an overnight window running into a special date as unresolved (H4), never as decided", () => {
    const status = estimateStatus(state([special({ date: "2026-10-31", kind: "closed" })]), SAT_0100, "Asia/Kolkata")
    expect(status.byOrderType.delivery.immediate).toMatchObject({ state: "unresolved", reason: "overnight_into_special_date" })
    // Other order types are unaffected by a delivery special date.
    expect(status.byOrderType.takeaway.immediate.state).toBe("open")
    // Later that day, after the overnight window, the special date applies.
    expect(estimateStatus(state([special({ date: "2026-10-31" })]), SAT_1200, "Asia/Kolkata").byOrderType.delivery.immediate).toMatchObject({
      state: "closed",
      reason: "special_date",
    })
  })

  it("shows every order type paused while the restaurant is paused, until the server's end time", () => {
    const pause = {
      paused: true as const,
      duration: "30m" as const,
      since: "2026-10-31T06:20:00Z",
      until: "2026-10-31T06:50:00Z",
      untilLocal: "2026-10-31T12:20+05:30",
      timeZone: "Asia/Kolkata",
      reason: null,
      by: staff,
    }
    const status = estimateStatus(state([], pause), SAT_1200, "Asia/Kolkata")
    expect(status.byOrderType.dine_in.immediate).toEqual({ state: "paused", reason: "paused", until: "2026-10-31T06:50:00Z", nextOpening: null })
    // After the end time the pause has expired.
    expect(estimateStatus(state([], pause), new Date("2026-10-31T07:00:00Z"), "Asia/Kolkata").pause.paused).toBe(false)
  })

  it("uses the restaurant's zone, including on a DST day", () => {
    const london = { ...state(), weekly: { ...state().weekly, timeZone: "Europe/London" } }
    // Sunday 25 Oct 2026, 10:30 GMT: takeaway is open all day on Sunday in London.
    expect(estimateStatus(london, new Date("2026-10-25T10:30:00Z"), "Europe/London").byOrderType.takeaway.immediate.state).toBe("open")
  })
})
