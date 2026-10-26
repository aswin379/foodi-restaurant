import type { OrderType } from "@/lib/domain/order-types"
import type { DayRule } from "@/lib/hours/types"
import { emptyWeek, hoursLines, validateWindows, windowDraftsFromInput, type WeekDraft } from "@/lib/hours/weekly-hours"
import { MAX_WINDOWS_PER_DAY, mergeDayWindows, mergeTimes, WEEKDAYS, weekdayLabels, type Weekday } from "@/lib/time/weekly"

import { canonicalChannels, emptyDays, type MealPeriodLabel, type MealPeriodRef, type ScheduleDraft, type WindowDraft } from "./schedule"

// Reusable meal periods (B3b; PRD §3.4, H1, H6). A meal period is a named set
// of weekly times in the restaurant's zone, with no order types of its own:
// each item or category that uses it picks which of its order types do
// (MealPeriodRef). Changing a period changes it for everything that uses it.
// There are no presets. This is the frontend's working model for the
// PROPOSED contract in docs/meal-periods-ui.md.

export const MEAL_PERIOD_NAME_MAX = 40

export type MealPeriodStatus = "active" | "archived"

/** An item or category that uses a meal period. */
export type UsageRef = { id: string; name: string; archived: boolean }

export type MealPeriod = {
  id: string
  name: string
  status: MealPeriodStatus
  /** Times only, in the restaurant's zone; same rules as restaurant hours. */
  weekly: DayRule[]
  /** Computed by the server from current item and category schedules. */
  usage: { items: UsageRef[]; categories: UsageRef[] }
  /** Set by the server: used by an item on an order. Such periods can only be archived. */
  usedOnOrders: boolean
  /** PROPOSED optimistic-concurrency token for the shared definition. */
  version: string
  updatedAt: string | null
  updatedBy: string | null
}

export type MealPeriodDraft = { name: string; days: WeekDraft }

// ----- Usage ------------------------------------------------------------------

/** References from items and categories that aren't archived. These block archiving. */
export const activeUsage = (period: Pick<MealPeriod, "usage">) => ({
  items: period.usage.items.filter((ref) => !ref.archived),
  categories: period.usage.categories.filter((ref) => !ref.archived),
})

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** "2 items and 1 category", or null when nothing uses it. */
export function usageText(usage: { items: readonly unknown[]; categories: readonly unknown[] }): string | null {
  const parts = [
    usage.items.length ? plural(usage.items.length, "item", "items") : null,
    usage.categories.length ? plural(usage.categories.length, "category", "categories") : null,
  ].filter(Boolean)
  return parts.length ? parts.join(" and ") : null
}

/** Names and status by id, for schedule lines. */
export function mealPeriodLabels(periods: readonly MealPeriod[]): Map<string, MealPeriodLabel> {
  return new Map(periods.map((period) => [period.id, { name: period.name, archived: period.status === "archived" }]))
}

// ----- Drafts and validation --------------------------------------------------

export const mealPeriodPaths = {
  name: "period.name",
  days: "period.days",
  day: (day: Weekday) => `period.${day}`,
  window: (day: Weekday, key: string) => `period.${day}.${key}`,
  start: (day: Weekday, key: string) => `period.${day}.${key}.start`,
  end: (day: Weekday, key: string) => `period.${day}.${key}.end`,
}

/** Editor draft; keys derive from position, so server and client renders agree. */
export function mealPeriodDraftFrom(period?: Pick<MealPeriod, "name" | "weekly">): MealPeriodDraft {
  const days = emptyWeek()
  for (const rule of period?.weekly ?? []) {
    for (const day of rule.days) {
      days[day] = {
        enabled: true,
        allDay: rule.allDay,
        windows: rule.windows.map((window, index) => ({ key: `${day}-${index + 1}`, ...window })),
      }
    }
  }
  return { name: period?.name ?? "", days }
}

const isBlank = (window: { start: string; end: string }) => window.start === "" && window.end === ""

/** Shared by the editor and the server. Name uniqueness is a menu rule. */
export function validateMealPeriodDraft(draft: MealPeriodDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = draft.name.trim()
  if (!name) errors[mealPeriodPaths.name] = "Enter the meal period name."
  else if (name.length > MEAL_PERIOD_NAME_MAX) errors[mealPeriodPaths.name] = `Keep the name under ${MEAL_PERIOD_NAME_MAX} characters.`

  const enabled = WEEKDAYS.filter((day) => draft.days[day].enabled)
  if (enabled.length === 0) errors[mealPeriodPaths.days] = "Choose at least one day."
  for (const day of enabled) {
    const { allDay, windows } = draft.days[day]
    if (!allDay && windows.length === 0) {
      errors[mealPeriodPaths.day(day)] = `Choose All day or add times for ${weekdayLabels[day]}, or switch the day off.`
      continue
    }
    if (allDay) {
      if (windows.some((window) => !isBlank(window))) {
        errors[mealPeriodPaths.day(day)] = `${weekdayLabels[day]} is already all day. Remove the times or turn off All day.`
      }
      continue
    }
    if (windows.length > MAX_WINDOWS_PER_DAY) errors[mealPeriodPaths.day(day)] = `Use at most ${MAX_WINDOWS_PER_DAY} windows a day.`
    validateWindows(
      windows,
      {
        window: (key) => mealPeriodPaths.window(day, key),
        start: (key) => mealPeriodPaths.start(day, key),
        end: (key) => mealPeriodPaths.end(day, key),
      },
      errors
    )
  }
  return errors
}

/** Stored weekly times from a valid draft: windows merged, days with the same times grouped. */
export function weeklyFromDraft(days: WeekDraft): DayRule[] {
  const rules: DayRule[] = []
  for (const day of WEEKDAYS) {
    const { enabled, allDay, windows } = days[day]
    if (!enabled) continue
    const rule = { allDay, windows: allDay ? [] : mergeTimes(windows.map(({ start, end }) => ({ start, end }))) }
    if (!rule.allDay && rule.windows.length === 0) continue
    const signature = JSON.stringify(rule)
    const group = rules.find((candidate) => JSON.stringify({ allDay: candidate.allDay, windows: candidate.windows }) === signature)
    if (group) group.days.push(day)
    else rules.push({ days: [day], ...rule })
  }
  return rules
}

/** "Mon–Fri 12:00–15:00", "Sat, Sun All day". */
export const mealPeriodLines = (weekly: DayRule[]) => hoursLines(weekly)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** Builds a well-typed draft from untrusted input; validate afterwards. */
export function mealPeriodDraftFromInput(value: unknown): MealPeriodDraft {
  const raw = isRecord(value) ? value : {}
  const days = emptyWeek()
  const rawDays = isRecord(raw.days) ? raw.days : {}
  for (const day of WEEKDAYS) {
    const rawDay = rawDays[day]
    if (!isRecord(rawDay)) continue
    days[day] = { enabled: rawDay.enabled === true, allDay: rawDay.allDay === true, windows: windowDraftsFromInput(rawDay.windows) }
  }
  return { name: typeof raw.name === "string" ? raw.name.slice(0, 200) : "", days }
}

// ----- Convert to custom times -----------------------------------------------

/**
 * Custom-times draft with the same effective schedule as `refs` (B3b): each
 * period's times, for the reference's order types. A timed window for an
 * order type that's already available all day that day is left out, since it
 * adds nothing (and custom validation refuses it). Returns the ids of
 * periods that couldn't be found instead of guessing.
 */
export function customDraftFromMealPeriods(
  refs: readonly MealPeriodRef[],
  periods: readonly Pick<MealPeriod, "id" | "weekly">[],
  newKey: () => string
): { ok: true; draft: Extract<ScheduleDraft, { mode: "custom" }> } | { ok: false; missing: string[] } {
  const byId = new Map(periods.map((period) => [period.id, period]))
  const missing = refs.filter((ref) => !byId.has(ref.periodId)).map((ref) => ref.periodId)
  if (missing.length) return { ok: false, missing }

  const days = emptyDays()
  for (const day of WEEKDAYS) {
    const allDay = new Set<OrderType>()
    const timed: { start: string; end: string; channels: OrderType[] }[] = []
    for (const ref of refs) {
      for (const rule of byId.get(ref.periodId)!.weekly) {
        if (!rule.days.includes(day)) continue
        if (rule.allDay) ref.channels.forEach((type) => allDay.add(type))
        else timed.push(...rule.windows.map((window) => ({ ...window, channels: [...ref.channels] })))
      }
    }
    const windows: WindowDraft[] = mergeDayWindows(
      timed.map((window) => ({ ...window, channels: window.channels.filter((type) => !allDay.has(type)) })).filter((window) => window.channels.length > 0)
    ).map((window) => ({ key: newKey(), ...window }))
    if (allDay.size === 0 && windows.length === 0) continue
    days[day] = {
      enabled: true,
      allDay: allDay.size ? { channels: canonicalChannels(allDay) } : null,
      windows,
    }
  }
  return { ok: true, draft: { mode: "custom", days } }
}
