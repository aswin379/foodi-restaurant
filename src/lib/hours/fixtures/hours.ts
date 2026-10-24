import "server-only"

import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"
import { addDays, localClock, weekdayOf } from "@/lib/time/calendar"

import type { HoursState } from "../rules"
import type { Actor, SpecialDate } from "../types"

// PREVIEW SAMPLE DATA (development only). Labelled sample hours for the
// preview restaurant; every note says "(preview)". Only
// src/lib/hours/preview-source.ts may import this file.

const PREVIEW_STAFF: Actor = { kind: "staff", staff: { id: "prv-staff", name: "Preview staff" } }

function specialDate(
  id: string,
  date: string,
  fields: Pick<SpecialDate, "orderTypes" | "kind" | "allDay" | "windows" | "note">,
  createdAt: string
): SpecialDate {
  return {
    id,
    date,
    ...fields,
    editable: true,
    version: `${id}-1`,
    createdAt,
    createdBy: PREVIEW_STAFF,
    updatedAt: createdAt,
    updatedBy: PREVIEW_STAFF,
  }
}

export function buildFixtureHours(now: number): HoursState {
  const today = localClock(new Date(now), PREVIEW_RESTAURANT.timeZone).date
  const createdAt = new Date(now - 3 * 86_400_000).toISOString()

  // The first Saturday at least 3 days ahead: delivery runs Friday 18:00–02:00
  // the night before, so this date shows the H4 note in the editor.
  let saturday = addDays(today, 3)
  while (weekdayOf(saturday) !== "sat") saturday = addDays(saturday, 1)

  return {
    weekly: {
      timeZone: PREVIEW_RESTAURANT.timeZone,
      byOrderType: {
        delivery: [
          { days: ["mon", "tue", "wed", "thu"], allDay: false, windows: [{ start: "11:00", end: "15:00" }, { start: "18:00", end: "23:30" }] },
          { days: ["fri", "sat"], allDay: false, windows: [{ start: "11:00", end: "15:00" }, { start: "18:00", end: "02:00" }] },
          { days: ["sun"], allDay: false, windows: [{ start: "12:00", end: "22:00" }] },
        ],
        takeaway: [
          { days: ["mon", "tue", "wed", "thu", "fri"], allDay: false, windows: [{ start: "11:00", end: "22:00" }] },
          { days: ["sat", "sun"], allDay: true, windows: [] },
        ],
        dine_in: [
          {
            days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            allDay: false,
            windows: [{ start: "12:00", end: "15:00" }, { start: "19:00", end: "23:00" }],
          },
        ],
      },
      version: "prv-hours-1",
      updatedAt: createdAt,
      updatedBy: PREVIEW_STAFF,
    },
    specialDates: [
      specialDate(
        "prv-spd-past",
        addDays(today, -5),
        { orderTypes: ["delivery", "takeaway", "dine_in"], kind: "closed", allDay: false, windows: [], note: "Staff training (preview)" },
        createdAt
      ),
      specialDate(
        "prv-spd-closed",
        addDays(today, 10),
        { orderTypes: ["takeaway", "dine_in"], kind: "closed", allDay: false, windows: [], note: "Maintenance (preview)" },
        createdAt
      ),
      specialDate(
        "prv-spd-evening",
        addDays(today, 20),
        {
          orderTypes: ["delivery", "takeaway"],
          kind: "special_hours",
          allDay: false,
          windows: [{ start: "17:00", end: "01:00" }],
          note: "Festival evening (preview)",
        },
        createdAt
      ),
      specialDate(
        "prv-spd-event",
        saturday,
        {
          orderTypes: ["delivery"],
          kind: "special_hours",
          allDay: false,
          windows: [{ start: "12:00", end: "16:00" }],
          note: "Local event (preview)",
        },
        createdAt
      ),
    ],
    pause: { paused: false, lastResumedAt: null, lastResumedBy: null },
  }
}
