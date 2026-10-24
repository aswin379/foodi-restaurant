import { isOrderType, ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import {
  formatDays,
  MAX_WINDOWS_PER_DAY,
  mergeTimes,
  WEEKDAYS,
  weekdayLabels,
  type Weekday,
} from "@/lib/time/weekly"
import { isOvernight, parseLocalTime, validateWindow, windowProblemMessages, type TimeWindow } from "@/lib/time/windows"

import type { DayRule, WeeklyHours } from "./types"

// Weekly restaurant hours per order type (PRD §3.3, H2, H8). Validation here is
// shared by the editor and the server, so both report the same errors.

export type WindowDraft = { key: string; start: string; end: string }
export type DayDraft = { enabled: boolean; allDay: boolean; windows: WindowDraft[] }
export type WeekDraft = Record<Weekday, DayDraft>
export type HoursDraft = Record<OrderType, WeekDraft>

export function emptyWeek(): WeekDraft {
  const week = {} as WeekDraft
  for (const day of WEEKDAYS) week[day] = { enabled: false, allDay: false, windows: [] }
  return week
}

export function emptyHoursDraft(): HoursDraft {
  return Object.fromEntries(ORDER_TYPES.map((type) => [type, emptyWeek()])) as HoursDraft
}

/** Editor draft from stored hours. Keys derive from position, so server and client renders agree. */
export function hoursDraftFrom(hours: Pick<WeeklyHours, "byOrderType">): HoursDraft {
  const draft = emptyHoursDraft()
  for (const type of ORDER_TYPES) {
    for (const rule of hours.byOrderType[type]) {
      for (const day of rule.days) {
        draft[type][day] = {
          enabled: true,
          allDay: rule.allDay,
          windows: rule.windows.map((window, index) => ({ key: `${type}-${day}-${index + 1}`, ...window })),
        }
      }
    }
  }
  return draft
}

// ----- Validation -------------------------------------------------------------

export const hoursPaths = {
  type: (type: OrderType) => `hours.${type}`,
  day: (type: OrderType, day: Weekday) => `hours.${type}.${day}`,
  window: (type: OrderType, day: Weekday, key: string) => `hours.${type}.${day}.${key}`,
  start: (type: OrderType, day: Weekday, key: string) => `hours.${type}.${day}.${key}.start`,
  end: (type: OrderType, day: Weekday, key: string) => `hours.${type}.${day}.${key}.end`,
}

/** DOM id for an error path, e.g. "hours.delivery.mon" → "hours-delivery-mon". */
export const hoursFieldId = (path: string) => path.replaceAll(".", "-")

const isBlank = (window: WindowDraft) => window.start === "" && window.end === ""

export function validateWindows(
  windows: WindowDraft[],
  paths: { window: (key: string) => string; start: (key: string) => string; end: (key: string) => string },
  errors: Record<string, string>
) {
  for (const window of windows) {
    const startOk = parseLocalTime(window.start) !== null
    const endOk = parseLocalTime(window.end) !== null
    if (!startOk) errors[paths.start(window.key)] = "Enter a start time."
    if (!endOk) errors[paths.end(window.key)] = "Enter an end time."
    if (startOk && endOk) {
      const problem = validateWindow(window)
      if (problem) errors[paths.window(window.key)] = windowProblemMessages[problem]
    }
  }
}

export function validateHoursDraft(draft: HoursDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const type of ORDER_TYPES) {
    for (const day of WEEKDAYS) {
      const { enabled, allDay, windows } = draft[type][day]
      if (!enabled) continue
      const label = `${orderTypeLabels[type]} on ${weekdayLabels[day]}`
      if (!allDay && windows.length === 0) {
        errors[hoursPaths.day(type, day)] = `Choose All day or add opening hours for ${label}, or switch the day off.`
        continue
      }
      // H2: All day plus a timed window for the same order type and day is redundant.
      if (allDay && windows.some((window) => !isBlank(window))) {
        errors[hoursPaths.day(type, day)] =
          `${orderTypeLabels[type]} is already open all day on ${weekdayLabels[day]}. Remove the time windows or turn off All day.`
        continue
      }
      if (allDay) continue
      if (windows.length > MAX_WINDOWS_PER_DAY) {
        errors[hoursPaths.day(type, day)] = `Use at most ${MAX_WINDOWS_PER_DAY} windows a day.`
      }
      validateWindows(
        windows,
        {
          window: (key) => hoursPaths.window(type, day, key),
          start: (key) => hoursPaths.start(type, day, key),
          end: (key) => hoursPaths.end(type, day, key),
        },
        errors
      )
    }
  }
  return errors
}

/** Advice that doesn't block saving, e.g. an order type closed every day. */
export function hoursWarnings(draft: HoursDraft): string[] {
  return ORDER_TYPES.filter((type) => WEEKDAYS.every((day) => !draft[type][day].enabled)).map(
    (type) => `${orderTypeLabels[type]} is closed every day.`
  )
}

// ----- Saving -----------------------------------------------------------------

/** Rules per order type from a valid draft: windows merged, days with the same hours grouped. */
export function hoursFromDraft(draft: HoursDraft): Record<OrderType, DayRule[]> {
  const result = {} as Record<OrderType, DayRule[]>
  for (const type of ORDER_TYPES) {
    const rules: DayRule[] = []
    for (const day of WEEKDAYS) {
      const { enabled, allDay, windows } = draft[type][day]
      if (!enabled) continue
      const rule = { allDay, windows: allDay ? [] : mergeTimes(windows.map(({ start, end }) => ({ start, end }))) }
      if (!rule.allDay && rule.windows.length === 0) continue
      const signature = JSON.stringify(rule)
      const group = rules.find((candidate) => JSON.stringify({ allDay: candidate.allDay, windows: candidate.windows }) === signature)
      if (group) group.days.push(day)
      else rules.push({ days: [day], ...rule })
    }
    result[type] = rules
  }
  return result
}

// ----- Copy helpers -----------------------------------------------------------

const copyDay = (day: DayDraft, newKey: () => string): DayDraft => ({
  enabled: day.enabled,
  allDay: day.allDay,
  windows: day.windows.filter((window) => !isBlank(window)).map((window) => ({ ...window, key: newKey() })),
})

/** Replaces the target days of one order type with the hours of `from`. */
export function copyDayTo(draft: HoursDraft, type: OrderType, from: Weekday, targets: Weekday[], newKey: () => string): HoursDraft {
  const week = { ...draft[type] }
  for (const target of targets) if (target !== from) week[target] = copyDay(draft[type][from], newKey)
  return { ...draft, [type]: week }
}

export function copyToAllDays(draft: HoursDraft, type: OrderType, from: Weekday, newKey: () => string): HoursDraft {
  return copyDayTo(draft, type, from, [...WEEKDAYS], newKey)
}

/** "Same as delivery": replaces the whole week of `target` with the source's. */
export function sameAs(draft: HoursDraft, target: OrderType, source: OrderType, newKey: () => string): HoursDraft {
  const week = {} as WeekDraft
  for (const day of WEEKDAYS) week[day] = copyDay(draft[source][day], newKey)
  return { ...draft, [target]: week }
}

// ----- Display ----------------------------------------------------------------

export function formatTimes(window: TimeWindow) {
  return `${window.start}–${window.end}${isOvernight(window) ? " (+1 day)" : ""}`
}

/** One line per group of days, e.g. "Mon–Thu 11:00–15:00, 18:00–23:30" or "Sat, Sun All day". */
export function hoursLines(rules: DayRule[]): string[] {
  return rules.map(
    (rule) => `${formatDays(rule.days)} ${rule.allDay ? "All day" : rule.windows.map(formatTimes).join(", ")}`
  )
}

// ----- Untrusted input --------------------------------------------------------

const KEY_PATTERN = /^[\w-]{1,100}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
export const timeText = (value: unknown) => (typeof value === "string" ? value.slice(0, 5) : "")

export function windowDraftsFromInput(value: unknown): WindowDraft[] {
  return (Array.isArray(value) ? value : [])
    .slice(0, MAX_WINDOWS_PER_DAY + 1)
    .filter((window): window is Record<string, unknown> => isRecord(window) && typeof window.key === "string" && KEY_PATTERN.test(window.key))
    .map((window) => ({ key: window.key as string, start: timeText(window.start), end: timeText(window.end) }))
}

/** Builds a well-typed draft from untrusted input; validate afterwards. */
export function hoursDraftFromInput(value: unknown): HoursDraft {
  const draft = emptyHoursDraft()
  if (!isRecord(value)) return draft
  for (const [type, rawWeek] of Object.entries(value)) {
    if (!isOrderType(type) || !isRecord(rawWeek)) continue
    for (const day of WEEKDAYS) {
      const raw = rawWeek[day]
      if (!isRecord(raw)) continue
      draft[type][day] = { enabled: raw.enabled === true, allDay: raw.allDay === true, windows: windowDraftsFromInput(raw.windows) }
    }
  }
  return draft
}
