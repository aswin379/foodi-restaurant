import "server-only"

import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"
import { assertPreviewAllowed } from "@/lib/data-source/mode"
import { addDays, localClock, weekdayOf } from "@/lib/time/calendar"
import { isOvernight, parseLocalTime, type TimeWindow } from "@/lib/time/windows"

import { expirePause, type HoursState } from "./rules"
import type { AvailabilityStatus, ImmediateReason, OrderTypeStatus } from "./types"

// PREVIEW ESTIMATE (development only). A rough "open now?" per order type
// for sample data, so the status card has something to show in preview. It
// is labelled as an estimate, is never used in production (where only the
// server's status is shown), and deliberately leaves out what isn't decided:
// - H4: an overnight window running into a special date is "unresolved";
// - P-2: it makes no claim about scheduled orders (`scheduled: null`);
// - it doesn't calculate "until" or "next opening" times.

type DayHours =
  | { source: "weekly" | "special_date"; closed: true }
  | { source: "weekly" | "special_date"; closed: false; allDay: boolean; windows: TimeWindow[] }

function hoursOn(state: HoursState, date: string, type: OrderType): DayHours {
  const special = state.specialDates.find((candidate) => candidate.date === date && candidate.orderTypes.includes(type))
  if (special) {
    return special.kind === "closed"
      ? { source: "special_date", closed: true }
      : { source: "special_date", closed: false, allDay: special.allDay, windows: special.windows }
  }
  const weekday = weekdayOf(date)
  const rule = state.weekly.byOrderType[type].find((candidate) => candidate.days.includes(weekday))
  return rule ? { source: "weekly", closed: false, allDay: rule.allDay, windows: rule.windows } : { source: "weekly", closed: true }
}

const minutes = (time: string) => parseLocalTime(time)!

function estimateFor(state: HoursState, type: OrderType, today: string, now: number): OrderTypeStatus["immediate"] {
  const result = (state: OrderTypeStatus["immediate"]["state"], reason: ImmediateReason) => ({
    state,
    reason,
    until: null,
    nextOpening: null,
  })
  const current = hoursOn(state, today, type)
  const yesterday = hoursOn(state, addDays(today, -1), type)
  const tailRunning =
    !yesterday.closed && !yesterday.allDay && yesterday.windows.some((window) => isOvernight(window) && now < minutes(window.end))

  // H4 is unconfirmed: don't guess how an overnight window combines with a special date.
  if (tailRunning && current.source === "special_date") return result("unresolved", "overnight_into_special_date")

  if (!current.closed) {
    if (current.allDay) return result("open", current.source === "special_date" ? "special_date" : "all_day")
    const inWindow = current.windows.some(
      (window) => now >= minutes(window.start) && (isOvernight(window) || now < minutes(window.end))
    )
    if (inWindow) return result("open", current.source === "special_date" ? "special_date" : "weekly_hours")
  }
  if (tailRunning) return result("open", yesterday.source === "special_date" ? "special_date" : "weekly_hours")
  if (current.source === "special_date") return result("closed", "special_date")
  return result("closed", state.weekly.byOrderType[type].length === 0 ? "no_hours_set" : "weekly_hours")
}

export function estimateStatus(state: HoursState, now: Date, timeZone: string): AvailabilityStatus {
  assertPreviewAllowed()
  const pause = expirePause(state.pause, now)
  const { date, minutes: nowMinutes } = localClock(now, timeZone)
  const byOrderType = Object.fromEntries(
    ORDER_TYPES.map((type): [OrderType, OrderTypeStatus] => [
      type,
      {
        immediate: pause.paused
          ? { state: "paused", reason: "paused", until: pause.until, nextOpening: null }
          : estimateFor(state, type, date, nowMinutes),
        scheduled: null,
      },
    ])
  ) as Record<OrderType, OrderTypeStatus>
  return { asOf: now.toISOString(), timeZone, source: "preview_estimate", pause, byOrderType }
}
