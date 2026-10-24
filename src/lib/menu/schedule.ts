import { isOrderType, ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import {
  formatLocalTime,
  isOvernight,
  MINUTES_PER_DAY,
  nominalWindowMinutes,
  parseLocalTime,
  validateWindow,
  windowProblemMessages,
  type TimeWindow,
} from "@/lib/time/windows"

import type { ChannelSettings } from "./types"

// Item availability schedules (PRD v0.3 §3.2, §3.4, with Q12 and Q13). Times
// are local to the restaurant's IANA time zone. An item schedule only narrows
// availability (§3.1); whether an item is orderable at a given moment is
// decided by the server, never here.
//
// Rules from §3.2:
// - several windows per day;
// - an end earlier than the start is an overnight window that belongs to its
//   start day (Friday 22:00–02:00 runs into Saturday 02:00);
// - overlapping windows on the same day are merged when saved;
// - windows are at least 15 minutes.
//
// Q12: every window (and every All day entry) names the order types it
// applies to. They narrow the item's own order types, never widen them.
// Q13: a day can be "All day": the whole calendar day in the restaurant's
// zone, with its own order types. Timed windows on that day may only cover
// other order types, so nothing is redundant or contradictory.

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const weekdayLabels: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

export const weekdayShortLabels: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
}

export const MAX_WINDOWS_PER_DAY = 6

/** A timed window and the order types it applies to (PRD `channels`). */
export type ScheduleWindow = TimeWindow & { channels: OrderType[] }

/** The whole calendar day in the restaurant's zone, for these order types. */
export type AllDay = { channels: OrderType[] }

export type WeeklyRule = {
  days: Weekday[]
  allDay: AllDay | null
  windows: ScheduleWindow[]
}

/** Stored schedule: days with the same rule are grouped. */
export type ItemSchedule =
  | { mode: "always" }
  | {
      mode: "custom"
      /** The restaurant's zone when saved; set by the server, never the browser. */
      timeZone: string
      weekly: WeeklyRule[]
    }

export type WindowDraft = { key: string; start: string; end: string; channels: OrderType[] }
export type DayDraft = { enabled: boolean; allDay: AllDay | null; windows: WindowDraft[] }
export type ScheduleDraft = { mode: "always" } | { mode: "custom"; days: Record<Weekday, DayDraft> }

export const ALWAYS: ItemSchedule = { mode: "always" }

export function emptyDays(): Record<Weekday, DayDraft> {
  const days = {} as Record<Weekday, DayDraft>
  for (const day of WEEKDAYS) days[day] = { enabled: false, allDay: null, windows: [] }
  return days
}

/** Order types in their canonical order, without duplicates. */
export function canonicalChannels(channels: Iterable<OrderType>): OrderType[] {
  const set = new Set(channels)
  return ORDER_TYPES.filter((type) => set.has(type))
}

/** The order types an item is offered for. */
export function enabledChannels(settings: ChannelSettings): OrderType[] {
  return ORDER_TYPES.filter((type) => settings[type])
}

/**
 * Editor draft from a stored schedule. Row keys are derived from the day and
 * position, so server and client renders agree; new rows get random keys.
 */
export function scheduleDraftFrom(schedule: ItemSchedule): ScheduleDraft {
  if (schedule.mode === "always") return { mode: "always" }
  const days = emptyDays()
  for (const group of schedule.weekly) {
    for (const day of group.days) {
      days[day] = {
        enabled: true,
        allDay: group.allDay ? { channels: [...group.allDay.channels] } : null,
        windows: group.windows.map((window, index) => ({
          key: `${day}-${index + 1}`,
          start: window.start,
          end: window.end,
          channels: [...window.channels],
        })),
      }
    }
  }
  return { mode: "custom", days }
}

// ----- Validation -------------------------------------------------------------

/** Field paths for errors, matching the editor's field ids. */
export const schedulePaths = {
  root: "schedule",
  day: (day: Weekday) => `schedule.${day}`,
  allDay: (day: Weekday) => `schedule.${day}.allDay`,
  window: (day: Weekday, key: string) => `schedule.${day}.${key}`,
  start: (day: Weekday, key: string) => `schedule.${day}.${key}.start`,
  end: (day: Weekday, key: string) => `schedule.${day}.${key}.end`,
  channels: (day: Weekday, key: string) => `schedule.${day}.${key}.channels`,
}

/** "Delivery", "Delivery and Takeaway", "Delivery, Takeaway and Dine-in". */
export function listOrderTypes(channels: readonly OrderType[]) {
  const labels = canonicalChannels(channels).map((type) => orderTypeLabels[type])
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`
}

function channelProblem(channels: readonly OrderType[], offForItem: ReadonlySet<OrderType>): string | null {
  if (channels.length === 0) return "Choose at least one order type."
  const off = channels.filter((type) => offForItem.has(type))
  if (off.length === 0) return null
  const [verb, pronoun] = off.length === 1 ? ["is", "it"] : ["are", "them"]
  return `${listOrderTypes(off)} ${verb} off for this item. Untick ${pronoun} here, or turn ${pronoun} on under Order types.`
}

/**
 * Checks a schedule draft against the item's own order types (Q12). Shared by
 * the editor and the server, so both report the same errors.
 */
export function validateScheduleDraft(draft: ScheduleDraft, itemChannels: ChannelSettings): Record<string, string> {
  const errors: Record<string, string> = {}
  if (draft.mode === "always") return errors

  const enabled = WEEKDAYS.filter((day) => draft.days[day].enabled)
  if (enabled.length === 0) {
    errors[schedulePaths.root] = "Choose at least one day, or make the item always available."
    return errors
  }

  const offForItem = new Set(ORDER_TYPES.filter((type) => !itemChannels[type]))
  for (const day of enabled) {
    const { allDay, windows } = draft.days[day]
    if (!allDay && windows.length === 0) {
      errors[schedulePaths.day(day)] = `Choose All day or add a time window for ${weekdayLabels[day]}, or switch the day off.`
      continue
    }
    if (windows.length > MAX_WINDOWS_PER_DAY) {
      errors[schedulePaths.day(day)] = `Use at most ${MAX_WINDOWS_PER_DAY} windows a day.`
    }
    if (allDay) {
      const problem = channelProblem(allDay.channels, offForItem)
      if (problem) errors[schedulePaths.allDay(day)] = problem
    }
    for (const window of windows) {
      const startOk = parseLocalTime(window.start) !== null
      const endOk = parseLocalTime(window.end) !== null
      if (!startOk) errors[schedulePaths.start(day, window.key)] = "Enter a start time."
      if (!endOk) errors[schedulePaths.end(day, window.key)] = "Enter an end time."
      if (startOk && endOk) {
        const problem = validateWindow(window)
        if (problem) errors[schedulePaths.window(day, window.key)] = windowProblemMessages[problem]
      }

      const problem = channelProblem(window.channels, offForItem)
      // A timed window for an order type that's already available all day adds nothing.
      const covered = allDay ? window.channels.filter((type) => allDay.channels.includes(type)) : []
      if (problem) errors[schedulePaths.channels(day, window.key)] = problem
      else if (covered.length > 0) {
        const pronoun = covered.length === 1 ? "it" : "them"
        errors[schedulePaths.channels(day, window.key)] =
          `${listOrderTypes(covered)} ${covered.length === 1 ? "is" : "are"} already available all day on ${weekdayLabels[day]}. Untick ${pronoun} here, or remove ${pronoun} from All day.`
      }
    }
  }
  return errors
}

// ----- Saving -----------------------------------------------------------------

/**
 * Merges overlapping or touching times of one day (§3.2), keeping overnight
 * windows on their start day. Unlike a "same every day" schedule, an overnight
 * tail never wraps round to merge with the same day's morning.
 */
export function mergeTimes(windows: TimeWindow[]): TimeWindow[] {
  const intervals = windows
    .filter((window) => validateWindow(window) === null)
    .map((window) => {
      const start = parseLocalTime(window.start)!
      return [start, start + nominalWindowMinutes(window)!] as [number, number]
    })
    .sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const [start, end] of intervals) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  // Two overnight windows can't merge past a full day; cap at 24 hours less a minute.
  return merged.map(([start, end]) => ({
    start: formatLocalTime(start),
    end: formatLocalTime(Math.min(end, start + MINUTES_PER_DAY - 1)),
  }))
}

/**
 * Merges one day's windows per order type (§3.2 with Q12), then puts order
 * types with identical times back into one window. So 11:00–15:00 for
 * dine-in and takeaway stays one window, and 18:00–22:00 delivery stays
 * separate; two overlapping delivery windows become one.
 */
export function mergeDayWindows(windows: ScheduleWindow[]): ScheduleWindow[] {
  const byTimes = new Map<string, ScheduleWindow>()
  for (const type of ORDER_TYPES) {
    for (const times of mergeTimes(windows.filter((window) => window.channels.includes(type)))) {
      const key = `${times.start}-${times.end}`
      const window = byTimes.get(key) ?? { ...times, channels: [] }
      window.channels.push(type)
      byTimes.set(key, window)
    }
  }
  const sortKey = (window: TimeWindow) => {
    const start = parseLocalTime(window.start)!
    return [start, start + nominalWindowMinutes(window)!] as const
  }
  return [...byTimes.values()].sort((a, b) => {
    const [aStart, aEnd] = sortKey(a)
    const [bStart, bEnd] = sortKey(b)
    return aStart - bStart || aEnd - bEnd
  })
}

/** Stored schedule from a valid draft. Days with the same rule are grouped. */
export function scheduleFromDraft(draft: ScheduleDraft, timeZone: string): ItemSchedule {
  if (draft.mode === "always") return ALWAYS
  const weekly: WeeklyRule[] = []
  for (const day of WEEKDAYS) {
    const { enabled, allDay, windows } = draft.days[day]
    if (!enabled) continue
    const rule = {
      allDay: allDay && allDay.channels.length > 0 ? { channels: canonicalChannels(allDay.channels) } : null,
      windows: mergeDayWindows(windows.map(({ start, end, channels }) => ({ start, end, channels }))),
    }
    if (!rule.allDay && rule.windows.length === 0) continue
    const signature = JSON.stringify(rule)
    const group = weekly.find((candidate) => JSON.stringify({ allDay: candidate.allDay, windows: candidate.windows }) === signature)
    if (group) group.days.push(day)
    else weekly.push({ days: [day], ...rule })
  }
  return weekly.length === 0 ? ALWAYS : { mode: "custom", timeZone, weekly }
}

// ----- Display ----------------------------------------------------------------

/**
 * Order types in brackets, left out when they're all the item's order types
 * (the common case), so list rows stay short.
 */
function channelNote(channels: readonly OrderType[], itemChannels?: ChannelSettings) {
  if (itemChannels && enabledChannels(itemChannels).every((type) => channels.includes(type))) return null
  return canonicalChannels(channels)
    .map((type) => orderTypeLabels[type])
    .join(", ")
}

export function formatWindow(window: ScheduleWindow, itemChannels?: ChannelSettings) {
  const notes = [isOvernight(window) ? "+1 day" : null, channelNote(window.channels, itemChannels)].filter(Boolean)
  return `${window.start}–${window.end}${notes.length ? ` (${notes.join("; ")})` : ""}`
}

export function formatAllDay(allDay: AllDay, itemChannels?: ChannelSettings) {
  const note = channelNote(allDay.channels, itemChannels)
  return `All day${note ? ` (${note})` : ""}`
}

/** "Mon–Fri", "Sat, Sun", "Mon, Wed, Fri": consecutive days become ranges. */
export function formatDays(days: readonly Weekday[]) {
  const indexes = [...new Set(days)].map((day) => WEEKDAYS.indexOf(day)).sort((a, b) => a - b)
  if (indexes.length === 7) return "Every day"
  const runs: number[][] = []
  for (const index of indexes) {
    const run = runs.at(-1)
    if (run && index === run[run.length - 1] + 1) run.push(index)
    else runs.push([index])
  }
  return runs
    .flatMap((run) =>
      run.length >= 3
        ? [`${weekdayShortLabels[WEEKDAYS[run[0]]]}–${weekdayShortLabels[WEEKDAYS[run.at(-1)!]]}`]
        : run.map((index) => weekdayShortLabels[WEEKDAYS[index]])
    )
    .join(", ")
}

/**
 * One line per group, e.g. "Mon 11:00–15:00 (Takeaway, Dine-in), 18:00–22:00
 * (Delivery)". Pass the item's order types to leave out the ones that match.
 */
export function scheduleLines(schedule: ItemSchedule, itemChannels?: ChannelSettings): string[] {
  if (schedule.mode === "always") return []
  return schedule.weekly.map((group) => {
    const parts = [
      ...(group.allDay ? [formatAllDay(group.allDay, itemChannels)] : []),
      ...group.windows.map((window) => formatWindow(window, itemChannels)),
    ]
    return `${formatDays(group.days)} ${parts.join(", ")}`
  })
}

// ----- Untrusted input --------------------------------------------------------

const KEY_PATTERN = /^[\w-]{1,100}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const timeText = (value: unknown) => (typeof value === "string" ? value.slice(0, 5) : "")
const channelsFrom = (value: unknown) =>
  canonicalChannels((Array.isArray(value) ? value.slice(0, ORDER_TYPES.length * 2) : []).filter(isOrderType))

/** Builds a well-typed schedule draft from untrusted input; validate afterwards. */
export function scheduleDraftFromInput(value: unknown): ScheduleDraft {
  if (!isRecord(value) || value.mode !== "custom" || !isRecord(value.days)) return { mode: "always" }
  const rawDays = value.days
  const days = emptyDays()
  for (const day of WEEKDAYS) {
    const raw = rawDays[day]
    if (!isRecord(raw)) continue
    const windows = (Array.isArray(raw.windows) ? raw.windows : [])
      .slice(0, MAX_WINDOWS_PER_DAY + 1)
      .filter(
        (window): window is Record<string, unknown> =>
          // "allDay" is reserved for the All day entry's error path.
          isRecord(window) && typeof window.key === "string" && KEY_PATTERN.test(window.key) && window.key !== "allDay"
      )
      .map((window) => ({
        key: window.key as string,
        start: timeText(window.start),
        end: timeText(window.end),
        channels: channelsFrom(window.channels),
      }))
    const allDay = isRecord(raw.allDay) ? { channels: channelsFrom(raw.allDay.channels) } : null
    days[day] = { enabled: raw.enabled === true, allDay, windows }
  }
  return { mode: "custom", days }
}
