// @vitest-environment node
import { describe, expect, it } from "vitest"

import { applyHoursCommand, expirePause, pauseEnd, withEditable, type HoursContext, type HoursState } from "./rules"
import type { SpecialDateDraft } from "./special-dates"
import type { SpecialDate } from "./types"
import { emptyHoursDraft, hoursDraftFrom } from "./weekly-hours"

const staff = { kind: "staff" as const, staff: { id: "s1", name: "Owner" } }
let counter = 0
const context = (now: string, timeZone = "Asia/Kolkata"): HoursContext => ({
  now: new Date(now),
  actor: staff,
  timeZone,
  newId: (kind) => `${kind}-${++counter}`,
})
const NOW = "2026-10-24T06:30:00Z" // 12:00 in Kolkata, Saturday 24 Oct

const specialDate = (overrides: Partial<SpecialDate> = {}): SpecialDate => ({
  id: "spd-a",
  date: "2026-11-08",
  orderTypes: ["takeaway"],
  kind: "closed",
  allDay: false,
  windows: [],
  note: null,
  editable: true,
  version: "spd-a-1",
  createdAt: "",
  createdBy: staff,
  updatedAt: "",
  updatedBy: staff,
  ...overrides,
})

const state = (overrides: Partial<HoursState> = {}): HoursState => ({
  weekly: {
    timeZone: "Asia/Kolkata",
    byOrderType: {
      delivery: [{ days: ["sat"], allDay: false, windows: [{ start: "11:00", end: "15:00" }] }],
      takeaway: [],
      dine_in: [],
    },
    version: "h-1",
    updatedAt: null,
    updatedBy: null,
  },
  specialDates: [specialDate(), specialDate({ id: "spd-past", date: "2026-10-20", version: "spd-past-1" })],
  pause: { paused: false, lastResumedAt: null, lastResumedBy: null },
  ...overrides,
})

const draft = (overrides: Partial<SpecialDateDraft> = {}): SpecialDateDraft => ({
  date: "2026-11-09",
  orderTypes: ["delivery"],
  kind: "closed",
  allDay: false,
  windows: [],
  note: "",
  ...overrides,
})

describe("save_hours", () => {
  it("stores merged hours with a new version and who changed them", () => {
    const hoursDraft = hoursDraftFrom(state().weekly)
    hoursDraft.dine_in.sun = { enabled: true, allDay: true, windows: [] }
    const { result } = applyHoursCommand(state(), { type: "save_hours", version: "h-1", draft: hoursDraft }, context(NOW))
    expect(result).toMatchObject({
      kind: "hours",
      hours: { version: "h-2", updatedBy: staff, byOrderType: { dine_in: [{ days: ["sun"], allDay: true, windows: [] }] } },
    })
  })

  it("refuses a stale version instead of overwriting someone else's change", () => {
    expect(() =>
      applyHoursCommand(state(), { type: "save_hours", version: "h-0", draft: emptyHoursDraft() }, context(NOW))
    ).toThrow(expect.objectContaining({ kind: "conflict", userMessage: "Hours were changed by someone else. Reload to see the latest." }))
  })
})

describe("special dates", () => {
  it("adds one with an id, version and audit fields", () => {
    const { result } = applyHoursCommand(state(), { type: "add_special_date", draft: draft({ note: "Diwali" }) }, context(NOW))
    expect(result).toMatchObject({
      kind: "special_date",
      specialDate: { date: "2026-11-09", note: "Diwali", editable: true, createdBy: staff, updatedBy: staff },
    })
  })

  it("refuses a duplicate date and order type as a conflict naming the order type", () => {
    expect(() =>
      applyHoursCommand(state(), { type: "add_special_date", draft: draft({ date: "2026-11-08", orderTypes: ["takeaway"] }) }, context(NOW))
    ).toThrow(
      expect.objectContaining({
        kind: "conflict",
        fieldErrors: { "specialDate.orderTypes": "Takeaway already has a special date on Sun, 8 Nov." },
      })
    )
  })

  it("decides 'today' with the restaurant's clock", () => {
    // 2026-10-23T20:00Z is already 24 Oct in Kolkata but still 23 Oct in London.
    const late = "2026-10-23T20:00:00Z"
    expect(() =>
      applyHoursCommand(state(), { type: "add_special_date", draft: draft({ date: "2026-10-23" }) }, context(late))
    ).toThrow(expect.objectContaining({ kind: "validation" }))
    expect(() =>
      applyHoursCommand(state(), { type: "add_special_date", draft: draft({ date: "2026-10-23" }) }, context(late, "Europe/London"))
    ).not.toThrow()
  })

  it("never edits or removes a past special date", () => {
    expect(() =>
      applyHoursCommand(state(), { type: "update_special_date", id: "spd-past", version: "spd-past-1", draft: draft() }, context(NOW))
    ).toThrow(expect.objectContaining({ kind: "conflict", userMessage: "Past special dates can't be changed." }))
    expect(() =>
      applyHoursCommand(state(), { type: "delete_special_date", id: "spd-past", version: "spd-past-1" }, context(NOW))
    ).toThrow(expect.objectContaining({ kind: "conflict", userMessage: "Past special dates can't be removed." }))
    expect(withEditable(state().specialDates, "2026-10-24").map((item) => [item.id, item.editable])).toEqual([
      ["spd-past", false],
      ["spd-a", true],
    ])
  })

  it("edits and removes a future one, checking its version", () => {
    const edited = applyHoursCommand(
      state(),
      { type: "update_special_date", id: "spd-a", version: "spd-a-1", draft: draft({ date: "2026-11-08", orderTypes: ["takeaway"], kind: "special_hours", allDay: true }) },
      context(NOW)
    )
    expect(edited.result).toMatchObject({ specialDate: { id: "spd-a", version: "spd-a-2", kind: "special_hours", allDay: true } })
    expect(() =>
      applyHoursCommand(state(), { type: "delete_special_date", id: "spd-a", version: "spd-a-0" }, context(NOW))
    ).toThrow(expect.objectContaining({ kind: "conflict" }))
    const removed = applyHoursCommand(state(), { type: "delete_special_date", id: "spd-a", version: "spd-a-1" }, context(NOW))
    expect(removed.state.specialDates.map((item) => item.id)).toEqual(["spd-past"])
    expect(() =>
      applyHoursCommand(state(), { type: "delete_special_date", id: "nope", version: "x" }, context(NOW))
    ).toThrow(expect.objectContaining({ kind: "not_found" }))
  })
})

describe("pause (H5, P-1)", () => {
  it("ends fixed durations after that time, and 'until resumed' never", () => {
    const now = new Date(NOW)
    expect(pauseEnd("15m", now, "Asia/Kolkata")?.toISOString()).toBe("2026-10-24T06:45:00.000Z")
    expect(pauseEnd("1h", now, "Asia/Kolkata")?.toISOString()).toBe("2026-10-24T07:30:00.000Z")
    expect(pauseEnd("until_resumed", now, "Asia/Kolkata")).toBeNull()
  })

  it("ends 'rest of today' at the restaurant's next local midnight", () => {
    const { result } = applyHoursCommand(state(), { type: "pause", duration: "rest_of_today", reason: "Gas supply" }, context(NOW))
    expect(result).toEqual({
      kind: "pause",
      pause: {
        paused: true,
        duration: "rest_of_today",
        since: "2026-10-24T06:30:00.000Z",
        until: "2026-10-24T18:30:00.000Z",
        untilLocal: "2026-10-25T00:00+05:30",
        timeZone: "Asia/Kolkata",
        reason: "Gas supply",
        by: staff,
      },
    })
  })

  it("handles daylight saving without running into the next local day", () => {
    // London, Saturday 24 Oct 21:00 BST: midnight is still BST (+01:00).
    expect(pauseEnd("rest_of_today", new Date("2026-10-24T20:00:00Z"), "Europe/London")?.toISOString()).toBe("2026-10-24T23:00:00.000Z")
    // Sunday 25 Oct is 25 hours long; the next midnight is GMT.
    const end = pauseEnd("rest_of_today", new Date("2026-10-25T12:00:00Z"), "Europe/London")!
    expect(end.toISOString()).toBe("2026-10-26T00:00:00.000Z")
    const paused = applyHoursCommand(state(), { type: "pause", duration: "rest_of_today", reason: "" }, context("2026-10-25T12:00:00Z", "Europe/London"))
    expect(paused.result).toMatchObject({ pause: { untilLocal: "2026-10-26T00:00+00:00", reason: null } })
  })

  it("refuses a second pause, and resuming twice changes nothing", () => {
    const paused = applyHoursCommand(state(), { type: "pause", duration: "30m", reason: "" }, context(NOW)).state
    expect(() => applyHoursCommand(paused, { type: "pause", duration: "1h", reason: "" }, context(NOW))).toThrow(
      expect.objectContaining({ kind: "conflict" })
    )
    const resumed = applyHoursCommand(paused, { type: "resume" }, context(NOW))
    expect(resumed.result).toEqual({ kind: "pause", pause: { paused: false, lastResumedAt: "2026-10-24T06:30:00.000Z", lastResumedBy: staff } })
    expect(applyHoursCommand(resumed.state, { type: "resume" }, context(NOW)).result).toEqual(resumed.result)
  })

  it("records an expired pause as resumed automatically by the system", () => {
    const paused = applyHoursCommand(state(), { type: "pause", duration: "15m", reason: "" }, context(NOW)).state.pause
    expect(expirePause(paused, new Date("2026-10-24T06:40:00Z"))).toBe(paused)
    expect(expirePause(paused, new Date("2026-10-24T06:45:00Z"))).toEqual({
      paused: false,
      lastResumedAt: "2026-10-24T06:45:00.000Z",
      lastResumedBy: { kind: "system" },
    })
  })
})
