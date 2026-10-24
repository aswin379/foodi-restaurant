import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import type { DayRule } from "@/lib/hours/types"
import { WEEKDAYS, weekdayShortLabels } from "@/lib/time/weekly"
import { formatLocalTime, MINUTES_PER_DAY, parseLocalTime, type TimeWindow } from "@/lib/time/windows"

import type { MealPeriod } from "./meal-periods"
import type { ItemSchedule, WeeklyRule } from "./schedule"
import type { ChannelSettings } from "./types"

// Restaurant-hours warnings for the item editor (B3b, PRD §3.2, H10).
//
// ADVISORY ONLY. This compares weekly clock times: restaurant weekly hours,
// the category's order types and schedule, and the item's order types and
// schedule, per order type, on a Monday-to-Sunday timeline. It leaves out
// special dates, pauses, sold out, a switched-off category and
// daylight-saving changes, and it never decides whether an item can be
// ordered; the backend does. Anything it can't work out reliably is reported
// as unresolved, never guessed.

const WEEK = 7 * MINUTES_PER_DAY

/** Half-open [start, end) in minutes from Monday 00:00. */
type Interval = readonly [number, number]

/** Sorted, merged, within one week; an interval past Sunday midnight wraps to Monday. */
function normalize(intervals: Interval[]): Interval[] {
  const split: Interval[] = []
  for (const [start, end] of intervals) {
    if (end <= start) continue
    if (end > WEEK) split.push([start, WEEK], [0, end - WEEK])
    else split.push([start, end])
  }
  split.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: [number, number][] = []
  for (const [start, end] of split) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

const FULL_WEEK: Interval[] = [[0, WEEK]]

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = []
  for (const [aStart, aEnd] of a) {
    for (const [bStart, bEnd] of b) {
      const start = Math.max(aStart, bStart)
      const end = Math.min(aEnd, bEnd)
      if (start < end) result.push([start, end])
    }
  }
  return normalize(result)
}

function subtract(a: Interval[], b: Interval[]): Interval[] {
  let rest = a
  for (const [bStart, bEnd] of b) {
    rest = rest.flatMap(([start, end]): Interval[] => {
      if (bEnd <= start || bStart >= end) return [[start, end]]
      return [
        ...(bStart > start ? [[start, bStart] as const] : []),
        ...(bEnd < end ? [[bEnd, end] as const] : []),
      ]
    })
  }
  return normalize(rest)
}

/** A window on a weekday; an end at or before the start runs into the next day (PRD §3.2). */
function windowInterval(dayIndex: number, window: TimeWindow): Interval | null {
  const start = parseLocalTime(window.start)
  const end = parseLocalTime(window.end)
  if (start === null || end === null || start === end) return null
  const base = dayIndex * MINUTES_PER_DAY
  return [base + start, base + (end > start ? end : end + MINUTES_PER_DAY)]
}

const dayInterval = (dayIndex: number): Interval => [dayIndex * MINUTES_PER_DAY, (dayIndex + 1) * MINUTES_PER_DAY]

/** Restaurant hours or meal-period times (no order types). */
function dayRuleIntervals(rules: readonly DayRule[]): Interval[] {
  const intervals: Interval[] = []
  for (const rule of rules) {
    for (const day of rule.days) {
      const index = WEEKDAYS.indexOf(day)
      if (rule.allDay) intervals.push(dayInterval(index))
      for (const window of rule.windows) {
        const interval = windowInterval(index, window)
        if (interval) intervals.push(interval)
      }
    }
  }
  return normalize(intervals)
}

/** Custom schedule times for one order type (Q12, Q13). */
function weeklyRuleIntervals(rules: readonly WeeklyRule[], type: OrderType): Interval[] {
  const intervals: Interval[] = []
  for (const rule of rules) {
    for (const day of rule.days) {
      const index = WEEKDAYS.indexOf(day)
      if (rule.allDay?.channels.includes(type)) intervals.push(dayInterval(index))
      for (const window of rule.windows) {
        if (!window.channels.includes(type)) continue
        const interval = windowInterval(index, window)
        if (interval) intervals.push(interval)
      }
    }
  }
  return normalize(intervals)
}

// ----- Formatting --------------------------------------------------------------

const dayName = (minute: number) => weekdayShortLabels[WEEKDAYS[Math.floor(minute / MINUTES_PER_DAY) % 7]]
const clock = (minute: number) => formatLocalTime(minute % MINUTES_PER_DAY)

/** "Sat 15:00–16:00", "Fri 23:00–01:00 (+1 day)", "Mon 00:00 to Wed 12:00". */
function formatInterval(start: number, end: number) {
  const startDay = Math.floor(start / MINUTES_PER_DAY)
  const length = end - start
  if (start % MINUTES_PER_DAY === 0 && length === MINUTES_PER_DAY) return `${dayName(start)} all day`
  if (Math.floor((end - 1) / MINUTES_PER_DAY) === startDay && end % MINUTES_PER_DAY !== 0) {
    return `${dayName(start)} ${clock(start)}–${clock(end)}`
  }
  if (length <= MINUTES_PER_DAY) return `${dayName(start)} ${clock(start)}–${clock(end)} (+1 day)`
  return `${dayName(start)} ${clock(start)} to ${dayName(end % WEEK)} ${clock(end)}`
}

const TIMES_SHOWN = 4

/** Times for display; a range across Sunday midnight is shown as one. */
function formatIntervals(intervals: Interval[]): string[] {
  const list = intervals.map(([start, end]) => [start, end] as [number, number])
  if (list.length > 1 && list[0][0] === 0 && list.at(-1)![1] === WEEK) {
    const first = list.shift()!
    list[list.length - 1][1] = WEEK + first[1]
  }
  const lines = list.map(([start, end]) => formatInterval(start, end))
  return lines.length > TIMES_SHOWN ? [...lines.slice(0, TIMES_SHOWN), `and ${lines.length - TIMES_SHOWN} more`] : lines
}

// ----- The check -------------------------------------------------------------------

/** Restaurant hours as the item editor gets them (never preview hours for a non-preview menu). */
export type HoursForCheck =
  | { kind: "loaded"; timeZone: string; byOrderType: Record<OrderType, DayRule[]> }
  | { kind: "unavailable"; reason: string }

export type HoursFinding = {
  severity: "advisory" | "strong"
  message: string
  /** Times the finding is about, formatted for display. */
  times: string[]
}

export type HoursCheck =
  /** Something couldn't be worked out reliably, so nothing is claimed. */
  | { kind: "unresolved"; reasons: string[] }
  | {
      kind: "checked"
      /** True when no order type has any time left (or the category turns them all off). */
      neverOrderable: boolean
      /** Empty = the schedules fit inside weekly restaurant hours. */
      findings: HoursFinding[]
    }

export type HoursCheckInput = {
  /** The restaurant's zone from the menu context. */
  timeZone: string
  /** Null when restaurant hours couldn't be loaded (or can't be used, see `hoursProblem`). */
  hours: { timeZone: string; byOrderType: Record<OrderType, DayRule[]> } | null
  /** Why `hours` is null, when the caller knows. */
  hoursProblem?: string
  /** The item's order types and schedule (the editor's draft, as it would be saved). */
  item: { channels: ChannelSettings; schedule: ItemSchedule }
  /** The item's category; null when it isn't in the loaded list. */
  category: { name: string; channels: ChannelSettings; schedule: ItemSchedule } | null
  /** Null when meal periods couldn't be loaded. */
  mealPeriods: readonly MealPeriod[] | null
}

type Resolved = { kind: "ok"; intervals: (type: OrderType) => Interval[] } | { kind: "unresolved"; reasons: string[] }

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function resolveSchedule(
  schedule: ItemSchedule,
  /** "this item's", "the Breakfast category's" */
  whose: string,
  timeZone: string,
  mealPeriods: readonly MealPeriod[] | null
): Resolved {
  if (schedule.mode === "always") return { kind: "ok", intervals: () => FULL_WEEK }
  if (schedule.mode === "custom") {
    if (schedule.timeZone !== timeZone) {
      return { kind: "unresolved", reasons: [`${capitalize(whose)} schedule was saved for ${schedule.timeZone}, not ${timeZone}.`] }
    }
    return { kind: "ok", intervals: (type) => weeklyRuleIntervals(schedule.weekly, type) }
  }
  if (!mealPeriods) return { kind: "unresolved", reasons: ["Meal periods couldn't be loaded."] }
  const reasons: string[] = []
  const used: { period: MealPeriod; channels: OrderType[] }[] = []
  for (const ref of schedule.periods) {
    const period = mealPeriods.find((candidate) => candidate.id === ref.periodId)
    if (!period) reasons.push(`A meal period used by ${whose} schedule wasn't found.`)
    else if (period.status === "archived") reasons.push(`${period.name}, used by ${whose} schedule, is archived.`)
    else used.push({ period, channels: ref.channels })
  }
  if (reasons.length) return { kind: "unresolved", reasons }
  return {
    kind: "ok",
    intervals: (type) =>
      normalize(used.filter((ref) => ref.channels.includes(type)).flatMap((ref) => dayRuleIntervals(ref.period.weekly))),
  }
}

/**
 * Compares the item's effective weekly schedule with restaurant hours. The
 * result is advice for the editor, never availability.
 */
export function checkAgainstHours(input: HoursCheckInput): HoursCheck {
  const reasons: string[] = []
  const { hours, category, timeZone } = input
  if (!hours) reasons.push(input.hoursProblem ?? "Restaurant hours couldn't be loaded.")
  else if (hours.timeZone !== timeZone) reasons.push(`Restaurant hours use ${hours.timeZone}, but the menu uses ${timeZone}.`)
  if (!category) reasons.push("The item's category couldn't be found.")
  const itemSchedule = resolveSchedule(input.item.schedule, "this item's", timeZone, input.mealPeriods)
  if (itemSchedule.kind === "unresolved") reasons.push(...itemSchedule.reasons)
  const categorySchedule = category
    ? resolveSchedule(category.schedule, `the ${category.name} category's`, timeZone, input.mealPeriods)
    : null
  if (categorySchedule?.kind === "unresolved") reasons.push(...categorySchedule.reasons)
  if (reasons.length || !hours || !category || itemSchedule.kind !== "ok" || categorySchedule?.kind !== "ok") {
    return { kind: "unresolved", reasons: [...new Set(reasons)] }
  }

  const findings: HoursFinding[] = []
  const offered = ORDER_TYPES.filter((type) => input.item.channels[type] && category.channels[type])
  const itemTimed = input.item.schedule.mode !== "always"
  const categoryTimed = category.schedule.mode !== "always"
  let anyTime = false

  for (const type of offered) {
    const label = orderTypeLabels[type]
    const restaurant = dayRuleIntervals(hours.byOrderType[type])
    const categoryTimes = categorySchedule.intervals(type)
    const itemTimes = itemSchedule.intervals(type)
    const scheduled = intersect(categoryTimes, itemTimes)
    const effective = intersect(scheduled, restaurant)
    if (effective.length) anyTime = true

    if (itemTimed && categoryTimed) {
      const outsideCategory = subtract(itemTimes, categoryTimes)
      if (outsideCategory.length && scheduled.length) {
        findings.push({
          severity: "advisory",
          message: `${label}: part of this item's schedule is outside the ${category.name} category's schedule.`,
          times: formatIntervals(outsideCategory),
        })
      }
    }

    if (effective.length === 0) {
      const message =
        restaurant.length === 0
          ? `${label}: the restaurant has no ${label.toLowerCase()} hours.`
          : scheduled.length === 0
            ? itemTimed && categoryTimed
              ? `${label}: this item's schedule and the ${category.name} category's schedule never overlap.`
              : `${label}: the schedule has no times for ${label.toLowerCase()}.`
            : `${label}: the schedule is never within ${label.toLowerCase()} hours.`
      findings.push({ severity: "advisory", message, times: [] })
      continue
    }

    if (itemTimed || categoryTimed) {
      const outsideHours = subtract(scheduled, restaurant)
      if (outsideHours.length) {
        findings.push({
          severity: "advisory",
          message: `${label}: part of the schedule is outside ${label.toLowerCase()} hours.`,
          times: formatIntervals(outsideHours),
        })
      }
    }
  }

  if (offered.length === 0) {
    findings.unshift({
      severity: "strong",
      message: `This item may never be orderable: every order type it's offered for is off for the ${category.name} category.`,
      times: [],
    })
  } else if (!anyTime) {
    findings.unshift({
      severity: "strong",
      message: "This item may never be orderable: its schedule leaves no time inside restaurant hours for any order type.",
      times: [],
    })
  }

  return { kind: "checked", neverOrderable: offered.length === 0 || !anyTime, findings }
}
