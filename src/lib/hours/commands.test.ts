// @vitest-environment node
import { describe, expect, it } from "vitest"

import { parseHoursCommand } from "./commands"

describe("parseHoursCommand", () => {
  it("validates hours on the server with the editor's rules", () => {
    expect(
      parseHoursCommand({
        type: "save_hours",
        version: "h-1",
        draft: { takeaway: { sun: { enabled: true, allDay: true, windows: [{ key: "w", start: "10:00", end: "11:00" }] } } },
      })
    ).toEqual({
      ok: false,
      fieldErrors: { "hours.takeaway.sun": "Takeaway is already open all day on Sunday. Remove the time windows or turn off All day." },
    })
    expect(parseHoursCommand({ type: "save_hours", version: "h-1", draft: {} })).toMatchObject({ ok: true })
  })

  it("accepts only the five pause durations and a short reason", () => {
    expect(parseHoursCommand({ type: "pause", duration: "2h" })).toEqual({ ok: false, fieldErrors: { duration: "Choose how long to pause." } })
    expect(parseHoursCommand({ type: "pause", duration: "rest_of_today", reason: "x".repeat(201) })).toMatchObject({ ok: false })
    expect(parseHoursCommand({ type: "pause", duration: "rest_of_today", reason: "  Gas  " })).toEqual({
      ok: true,
      command: { type: "pause", duration: "rest_of_today", reason: "Gas" },
    })
  })

  it("keeps only known order types in a special date and rejects bad ids", () => {
    const parsed = parseHoursCommand({
      type: "add_special_date",
      draft: { date: "2026-11-08T10:00", orderTypes: ["pickup", "delivery", "delivery"], kind: "weird" },
    })
    expect(parsed).toMatchObject({ ok: true, command: { draft: { date: "2026-11-08", orderTypes: ["delivery"], kind: "closed" } } })
    expect(parseHoursCommand({ type: "delete_special_date", id: "<x>", version: "1" })).toMatchObject({ ok: false })
    expect(parseHoursCommand({ type: "launch" })).toMatchObject({ ok: false })
  })
})
