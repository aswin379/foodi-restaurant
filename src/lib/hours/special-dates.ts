import { isOrderType, ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import { addDays, formatCalendarDate, isCalendarDate, weekdayOf } from "@/lib/time/calendar"
import { MAX_WINDOWS_PER_DAY, mergeTimes } from "@/lib/time/weekly"
import { isOvernight, type TimeWindow } from "@/lib/time/windows"

import { listLabels } from "./labels"
import type { SpecialDate, SpecialDateKind, WeeklyHours } from "./types"
import { formatTimes, validateWindows, windowDraftsFromInput, type WindowDraft } from "./weekly-hours"

// Special dates (H3): closed or special hours on one calendar date, for the
// selected order types only. Other order types keep their weekly hours.

export const NOTE_MAX = 80

export type SpecialDateDraft = {
  date: string
  orderTypes: OrderType[]
  kind: SpecialDateKind
  allDay: boolean
  windows: WindowDraft[]
  note: string
}

export const specialDatePaths = {
  date: "specialDate.date",
  orderTypes: "specialDate.orderTypes",
  hours: "specialDate.hours",
  note: "specialDate.note",
  window: (key: string) => `specialDate.windows.${key}`,
  start: (key: string) => `specialDate.windows.${key}.start`,
  end: (key: string) => `specialDate.windows.${key}.end`,
}

export function specialDateDraftFrom(specialDate: SpecialDate | null, today: string): SpecialDateDraft {
  if (!specialDate) return { date: today, orderTypes: [...ORDER_TYPES], kind: "closed", allDay: false, windows: [], note: "" }
  return {
    date: specialDate.date,
    orderTypes: [...specialDate.orderTypes],
    kind: specialDate.kind,
    allDay: specialDate.allDay,
    windows: specialDate.windows.map((window, index) => ({ key: `w-${index + 1}`, ...window })),
    note: specialDate.note ?? "",
  }
}

/**
 * Checks a draft. `others` are the restaurant's other special dates (the one
 * being edited excluded), for the one-per-date-and-order-type rule. `today`
 * is the restaurant-local date, decided by the server.
 */
export function validateSpecialDateDraft(
  draft: SpecialDateDraft,
  context: { today: string; others: SpecialDate[] }
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!isCalendarDate(draft.date)) errors[specialDatePaths.date] = "Choose a date."
  else if (draft.date < context.today) errors[specialDatePaths.date] = "Choose today or a later date."

  if (draft.orderTypes.length === 0) errors[specialDatePaths.orderTypes] = "Choose at least one order type."
  else {
    const taken = takenOrderTypes(draft, context.others)
    if (taken.length) {
      errors[specialDatePaths.orderTypes] =
        `${listLabels(taken.map((type) => orderTypeLabels[type]))} already ${taken.length === 1 ? "has" : "have"} a special date on ${formatCalendarDate(draft.date, "en-IN", "short")}.`
    }
  }

  if (draft.kind === "special_hours") {
    if (!draft.allDay && draft.windows.length === 0) {
      errors[specialDatePaths.hours] = "Choose All day or add opening hours, or mark the date as closed."
    } else if (draft.allDay && draft.windows.some((window) => window.start || window.end)) {
      errors[specialDatePaths.hours] = "All day is already chosen. Remove the time windows or turn off All day."
    } else if (!draft.allDay) {
      if (draft.windows.length > MAX_WINDOWS_PER_DAY) errors[specialDatePaths.hours] = `Use at most ${MAX_WINDOWS_PER_DAY} windows.`
      validateWindows(draft.windows, specialDatePaths, errors)
    }
  }

  if (draft.note.trim().length > NOTE_MAX) errors[specialDatePaths.note] = `Keep the note under ${NOTE_MAX} characters.`
  return errors
}

/** Order types of the draft that already have another special date on the same date. */
export function takenOrderTypes(draft: Pick<SpecialDateDraft, "date" | "orderTypes">, others: SpecialDate[]): OrderType[] {
  if (!isCalendarDate(draft.date)) return []
  return draft.orderTypes.filter((type) =>
    others.some((other) => other.date === draft.date && other.orderTypes.includes(type))
  )
}

/** The stored fields of a valid draft; windows merged. */
export function specialDateFields(draft: SpecialDateDraft) {
  const hours = draft.kind === "special_hours"
  return {
    date: draft.date,
    orderTypes: ORDER_TYPES.filter((type) => draft.orderTypes.includes(type)),
    kind: draft.kind,
    allDay: hours && draft.allDay,
    windows: hours && !draft.allDay ? mergeTimes(draft.windows.map(({ start, end }) => ({ start, end }))) : [],
    note: draft.note.trim() || null,
  }
}

export function specialDateSummary(specialDate: Pick<SpecialDate, "kind" | "allDay" | "windows">) {
  if (specialDate.kind === "closed") return "Closed"
  return specialDate.allDay ? "Open all day" : `Open ${specialDate.windows.map(formatTimes).join(", ")}`
}

/**
 * H4 (unconfirmed): overnight windows from the day before that run past
 * midnight into `date`, per order type. This only detects the overlap so the
 * editor can mention it; how it combines with the special date is not
 * decided here, and nothing is calculated from it.
 */
export function overnightIntoDate(
  date: string,
  orderTypes: OrderType[],
  weekly: Pick<WeeklyHours, "byOrderType">,
  specialDates: SpecialDate[]
): Array<{ type: OrderType; window: TimeWindow; from: "weekly" | "special_date" }> {
  if (!isCalendarDate(date)) return []
  const previous = addDays(date, -1)
  const previousDay = weekdayOf(previous)
  return orderTypes.flatMap((type) => {
    const special = specialDates.find((candidate) => candidate.date === previous && candidate.orderTypes.includes(type))
    const windows = special
      ? special.kind === "special_hours" && !special.allDay
        ? special.windows
        : []
      : weekly.byOrderType[type].filter((rule) => rule.days.includes(previousDay) && !rule.allDay).flatMap((rule) => rule.windows)
    return windows.filter(isOvernight).map((window) => ({ type, window, from: special ? ("special_date" as const) : ("weekly" as const) }))
  })
}

// ----- Untrusted input --------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

export function specialDateDraftFromInput(value: unknown): SpecialDateDraft {
  const raw = isRecord(value) ? value : {}
  const orderTypes = Array.isArray(raw.orderTypes) ? raw.orderTypes.filter(isOrderType) : []
  return {
    date: typeof raw.date === "string" ? raw.date.slice(0, 10) : "",
    orderTypes: ORDER_TYPES.filter((type) => orderTypes.includes(type)),
    kind: raw.kind === "special_hours" ? "special_hours" : "closed",
    allDay: raw.allDay === true,
    windows: windowDraftsFromInput(raw.windows),
    note: typeof raw.note === "string" ? raw.note.slice(0, NOTE_MAX + 50) : "",
  }
}
