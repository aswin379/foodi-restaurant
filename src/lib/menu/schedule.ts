import { isOrderType, ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import {
  coveredBy,
  formatDays,
  MAX_WINDOWS_PER_DAY,
  mergeDayWindows,
  WEEKDAYS,
  weekdayLabels,
  type ChannelWindow,
  type Weekday,
} from "@/lib/time/weekly"
import { isOvernight, parseLocalTime, validateWindow, windowProblemMessages } from "@/lib/time/windows"

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
//
// B3b: categories use the same schedules, and a third mode references
// reusable meal periods (meal-periods.ts) instead of custom windows. The
// "always" and "custom" modes are unchanged.

// Shared with restaurant hours; re-exported so Menu imports stay unchanged.
export {
  formatDays,
  MAX_WINDOWS_PER_DAY,
  mergeDayWindows,
  mergeTimes,
  WEEKDAYS,
  weekdayLabels,
  weekdayShortLabels,
  type Weekday,
} from "@/lib/time/weekly"

/** A timed window and the order types it applies to (PRD `channels`). */
export type ScheduleWindow = ChannelWindow

/** The whole calendar day in the restaurant's zone, for these order types. */
export type AllDay = { channels: OrderType[] }

export type WeeklyRule = {
  days: Weekday[]
  allDay: AllDay | null
  windows: ScheduleWindow[]
}

/**
 * One meal period used by an item or category (B3b, H1). The period holds
 * times only; the reference picks which of its owner's order types use them.
 */
export type MealPeriodRef = { periodId: string; channels: OrderType[] }

/**
 * Stored schedule: days with the same rule are grouped. Used by items and
 * (since B3b) categories. "meal_periods" never mixes with custom windows.
 */
export type ItemSchedule =
  | { mode: "always" }
  | {
      mode: "custom"
      /** The restaurant's zone when saved; set by the server, never the browser. */
      timeZone: string
      weekly: WeeklyRule[]
    }
  | { mode: "meal_periods"; periods: MealPeriodRef[] }

export type WindowDraft = { key: string; start: string; end: string; channels: OrderType[] }
export type DayDraft = { enabled: boolean; allDay: AllDay | null; windows: WindowDraft[] }
export type ScheduleDraft =
  | { mode: "always" }
  | { mode: "custom"; days: Record<Weekday, DayDraft> }
  | { mode: "meal_periods"; periods: MealPeriodRef[] }

/** Whose schedule it is, for wording: an item's or a category's. */
export type ScheduleOwner = "item" | "category"

/** At most this many meal periods per schedule. */
export const MAX_MEAL_PERIOD_REFS = 6

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
  if (schedule.mode === "meal_periods") {
    return { mode: "meal_periods", periods: schedule.periods.map((ref) => ({ periodId: ref.periodId, channels: [...ref.channels] })) }
  }
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
  /** A meal-period reference, and its order types. */
  period: (periodId: string) => `schedule.periods.${periodId}`,
  periodChannels: (periodId: string) => `schedule.periods.${periodId}.channels`,
}

/** "Delivery", "Delivery and Takeaway", "Delivery, Takeaway and Dine-in". */
export function listOrderTypes(channels: readonly OrderType[]) {
  const labels = canonicalChannels(channels).map((type) => orderTypeLabels[type])
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`
}

function channelProblem(
  channels: readonly OrderType[],
  offForItem: ReadonlySet<OrderType>,
  owner: ScheduleOwner = "item"
): string | null {
  if (channels.length === 0) return "Choose at least one order type."
  const off = channels.filter((type) => offForItem.has(type))
  if (off.length === 0) return null
  const [verb, pronoun] = off.length === 1 ? ["is", "it"] : ["are", "them"]
  return `${listOrderTypes(off)} ${verb} off for this ${owner}. Untick ${pronoun} here, or turn ${pronoun} on under Order types.`
}

function validateMealPeriodRefs(
  periods: readonly MealPeriodRef[],
  offForOwner: ReadonlySet<OrderType>,
  owner: ScheduleOwner
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (periods.length === 0) {
    errors[schedulePaths.root] = `Choose a meal period, or make the ${owner} always available.`
    return errors
  }
  if (periods.length > MAX_MEAL_PERIOD_REFS) {
    errors[schedulePaths.root] = `Use at most ${MAX_MEAL_PERIOD_REFS} meal periods.`
  }
  const seen = new Set<string>()
  for (const ref of periods) {
    if (seen.has(ref.periodId)) errors[schedulePaths.period(ref.periodId)] = "This meal period is already chosen."
    seen.add(ref.periodId)
    const problem = channelProblem(ref.channels, offForOwner, owner)
    if (problem) errors[schedulePaths.periodChannels(ref.periodId)] = problem
  }
  return errors
}

/**
 * Checks a schedule draft against its owner's order types (Q12; categories
 * since B3b). Shared by the editor and the server, so both report the same
 * errors. Whether referenced meal periods exist and are active is checked
 * by the menu rules, which can see them.
 */
export function validateScheduleDraft(
  draft: ScheduleDraft,
  itemChannels: ChannelSettings,
  owner: ScheduleOwner = "item"
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (draft.mode === "always") return errors

  const offForItem = new Set(ORDER_TYPES.filter((type) => !itemChannels[type]))
  if (draft.mode === "meal_periods") return validateMealPeriodRefs(draft.periods, offForItem, owner)

  const enabled = WEEKDAYS.filter((day) => draft.days[day].enabled)
  if (enabled.length === 0) {
    errors[schedulePaths.root] = `Choose at least one day, or make the ${owner} always available.`
    return errors
  }

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
      const problem = channelProblem(allDay.channels, offForItem, owner)
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

      const problem = channelProblem(window.channels, offForItem, owner)
      // A timed window for an order type that's already available all day adds nothing.
      const covered = allDay ? coveredBy(allDay.channels, window.channels) : []
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

/** Stored schedule from a valid draft. Days with the same rule are grouped. */
export function scheduleFromDraft(draft: ScheduleDraft, timeZone: string): ItemSchedule {
  if (draft.mode === "always") return ALWAYS
  if (draft.mode === "meal_periods") {
    // Meal periods use the restaurant's zone when evaluated; the reference stores no zone.
    const periods = draft.periods.map((ref) => ({ periodId: ref.periodId, channels: canonicalChannels(ref.channels) }))
    return periods.length === 0 ? ALWAYS : { mode: "meal_periods", periods }
  }
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

/** What a schedule line needs to know about a meal period. */
export type MealPeriodLabel = { name: string; archived: boolean }

/**
 * One line per group, e.g. "Mon 11:00–15:00 (Takeaway, Dine-in), 18:00–22:00
 * (Delivery)". Pass the item's order types to leave out the ones that match.
 * Meal-period schedules give one line per period, e.g. "Lunch (Delivery)";
 * a period missing from `periods` is shown as unknown, never guessed.
 */
export function scheduleLines(
  schedule: ItemSchedule,
  itemChannels?: ChannelSettings,
  periods?: ReadonlyMap<string, MealPeriodLabel>
): string[] {
  if (schedule.mode === "always") return []
  if (schedule.mode === "meal_periods") {
    return schedule.periods.map((ref) => {
      const period = periods?.get(ref.periodId)
      const notes = [period?.archived ? "archived" : null, channelNote(ref.channels, itemChannels)].filter(Boolean)
      return `${period ? period.name : "Unknown meal period"}${notes.length ? ` (${notes.join("; ")})` : ""}`
    })
  }
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

function mealPeriodRefsFromInput(value: unknown): MealPeriodRef[] {
  return (Array.isArray(value) ? value.slice(0, MAX_MEAL_PERIOD_REFS + 1) : [])
    .filter(
      (ref): ref is Record<string, unknown> =>
        isRecord(ref) && typeof ref.periodId === "string" && KEY_PATTERN.test(ref.periodId)
    )
    .map((ref) => ({ periodId: ref.periodId as string, channels: channelsFrom(ref.channels) }))
}

/**
 * Builds a well-typed schedule draft from untrusted input; validate
 * afterwards. Anything that isn't a custom or meal-period draft is "always",
 * as in B2.
 */
export function scheduleDraftFromInput(value: unknown): ScheduleDraft {
  if (isRecord(value) && value.mode === "meal_periods") {
    return { mode: "meal_periods", periods: mealPeriodRefsFromInput(value.periods) }
  }
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
