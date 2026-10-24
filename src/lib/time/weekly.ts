import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"

import {
  formatLocalTime,
  MINUTES_PER_DAY,
  nominalWindowMinutes,
  parseLocalTime,
  validateWindow,
  type TimeWindow,
} from "./windows"

// Weekly schedule helpers shared by item schedules (Menu) and restaurant
// hours. Times are local to the restaurant's zone (PRD §3.2). These only
// shape what an editor saves; whether anything is available at a moment is
// decided by the server.
//
// Rules from §3.2: several windows per day; an end earlier than the start is
// an overnight window that belongs to its start day; overlapping windows on a
// day are merged when saved.

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

/** The day after, wrapping Sunday to Monday. */
export function nextWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 1) % 7]
}

/** The day before, wrapping Monday to Sunday. */
export function previousWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7]
}

/** A timed window and the order types it applies to (PRD `channels`). */
export type ChannelWindow = TimeWindow & { channels: OrderType[] }

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
export function mergeDayWindows(windows: ChannelWindow[]): ChannelWindow[] {
  const byTimes = new Map<string, ChannelWindow>()
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

/**
 * Order types of a timed window that an All day entry already covers. A
 * non-empty result means the window repeats All day for those order types,
 * which editors refuse as redundant.
 */
export function coveredBy(allDayTypes: readonly OrderType[], windowTypes: readonly OrderType[]): OrderType[] {
  return windowTypes.filter((type) => allDayTypes.includes(type))
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
