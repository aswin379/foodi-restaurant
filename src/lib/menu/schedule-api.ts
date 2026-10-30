import { fromApiOrderType, toApiOrderType } from "@/lib/api/mapping"
import { ServiceError } from "@/lib/data-source/errors"
import type { OrderType } from "@/lib/domain/order-types"

import {
  canonicalChannels,
  enabledChannels,
  WEEKDAYS,
  type ItemSchedule,
  type ScheduleDraft,
  type Weekday,
  type WeeklyRule,
} from "./schedule"
import type { ChannelSettings } from "./types"

// PROPOSED wire shape for item and category schedules (docs/menu-ui.md,
// "Item schedules"; meal periods in docs/meal-periods-ui.md). Order-type
// names go through src/lib/api/mapping.ts, the only place backend names may
// differ from the PRD's. No menu API exists yet.

type ApiWindow = { start: string; end: string; channels?: string[] }

export type ApiSchedule =
  | { mode: "always" }
  | {
      mode: "custom"
      timeZone: string
      weekly: Array<{ days: string[]; allDay?: { channels: string[] } | null; windows: ApiWindow[] }>
      /** PRD §3.2 schedule-level channels, from before Q12. Read only. */
      channels?: string[]
    }
  /** B3b. No legacy form, so read strictly. */
  | { mode: "meal_periods"; periods: Array<{ periodId: string; channels: string[] }> }

const toApi = (channels: readonly OrderType[]) => channels.map(toApiOrderType)

export function scheduleToApi(schedule: ItemSchedule): ApiSchedule {
  if (schedule.mode === "always") return schedule
  if (schedule.mode === "meal_periods") {
    return { mode: "meal_periods", periods: schedule.periods.map((ref) => ({ periodId: ref.periodId, channels: toApi(ref.channels) })) }
  }
  return {
    mode: "custom",
    timeZone: schedule.timeZone,
    weekly: schedule.weekly.map((rule) => ({
      days: rule.days,
      allDay: rule.allDay ? { channels: toApi(rule.allDay.channels) } : null,
      windows: rule.windows.map((window) => ({ start: window.start, end: window.end, channels: toApi(window.channels) })),
    })),
  }
}

/** A save_item or save_category draft's schedule, with order types in API names. */
export function scheduleDraftToApi(draft: ScheduleDraft): unknown {
  if (draft.mode === "always") return draft
  if (draft.mode === "meal_periods") {
    return { mode: "meal_periods", periods: draft.periods.map((ref) => ({ periodId: ref.periodId, channels: toApi(ref.channels) })) }
  }
  return {
    mode: "custom",
    days: Object.fromEntries(
      WEEKDAYS.map((day) => {
        const { enabled, allDay, windows } = draft.days[day]
        return [
          day,
          {
            enabled,
            allDay: allDay ? { channels: toApi(allDay.channels) } : null,
            windows: windows.map((window) => ({ ...window, channels: toApi(window.channels) })),
          },
        ]
      })
    ),
  }
}

const invalid = (detail: string) => new ServiceError("unavailable", `Invalid schedule from API: ${detail}`)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const isWeekday = (value: unknown): value is Weekday => typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value)

function channelsFromApi(value: unknown): OrderType[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw invalid("channels")
  return canonicalChannels((value as string[]).map(fromApiOrderType))
}

/**
 * Item (or category) schedule from an API response. Unknown values are
 * integration errors, never guessed at. A window without `channels` (the PRD
 * §3.2 shape before Q12) takes the schedule-level `channels`, or else all the
 * item's order types, which is what "default all" means once the item
 * narrows it. A missing schedule is "always", as before B3b.
 */
export function scheduleFromApi(value: unknown, itemChannels: ChannelSettings): ItemSchedule {
  if (value === undefined || value === null) return { mode: "always" }
  if (!isRecord(value)) throw invalid("not an object")
  if (value.mode === "always") return { mode: "always" }
  if (value.mode === "meal_periods") {
    if (!Array.isArray(value.periods)) throw invalid("periods")
    return {
      mode: "meal_periods",
      periods: value.periods.map((ref: unknown) => {
        if (!isRecord(ref) || typeof ref.periodId !== "string" || ref.periodId === "") throw invalid("meal period reference")
        // New in B3b, so there's no older shape to fall back to: channels are required.
        return { periodId: ref.periodId, channels: channelsFromApi(ref.channels) }
      }),
    }
  }
  if (value.mode !== "custom" || typeof value.timeZone !== "string" || !Array.isArray(value.weekly)) {
    throw invalid("mode, timeZone or weekly")
  }
  const fallback = value.channels === undefined ? enabledChannels(itemChannels) : channelsFromApi(value.channels)
  const weekly: WeeklyRule[] = value.weekly.map((rule: unknown) => {
    if (!isRecord(rule) || !Array.isArray(rule.days) || !rule.days.every(isWeekday)) throw invalid("days")
    const windows = rule.windows ?? []
    if (!Array.isArray(windows)) throw invalid("windows")
    return {
      days: rule.days,
      allDay: isRecord(rule.allDay) ? { channels: channelsFromApi(rule.allDay.channels) } : null,
      windows: windows.map((window: unknown) => {
        if (!isRecord(window) || typeof window.start !== "string" || typeof window.end !== "string") throw invalid("window")
        return {
          start: window.start,
          end: window.end,
          channels: window.channels === undefined ? fallback : channelsFromApi(window.channels),
        }
      }),
    }
  })
  return { mode: "custom", timeZone: value.timeZone, weekly }
}
