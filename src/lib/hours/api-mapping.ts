import { fromApiOrderType, toApiOrderType } from "@/lib/api/mapping"
import { ServiceError } from "@/lib/data-source/errors"
import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"
import { isCalendarDate } from "@/lib/time/calendar"
import { WEEKDAYS, type Weekday } from "@/lib/time/weekly"
import { parseLocalTime, type TimeWindow } from "@/lib/time/windows"

import type { HoursCommand } from "./commands"
import type { HoursCommandResult } from "./rules"
import { specialDateFields } from "./special-dates"
import {
  PAUSE_DURATIONS,
  SPECIAL_DATE_KINDS,
  type Actor,
  type AvailabilityStatus,
  type DayRule,
  type ImmediateReason,
  type OrderTypeStatus,
  type PauseState,
  type SpecialDate,
  type WeeklyHours,
} from "./types"
import { hoursFromDraft } from "./weekly-hours"

// Converts hours data between the PROPOSED API shape (docs/hours-ui.md) and
// the frontend model. Order types appear as record keys (`byOrderType`) and
// as values (`orderTypes`); both go through src/lib/api/mapping.ts. Anything
// unexpected in a response is an integration error, never guessed at.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid hours data from API: ${what}`)

function string(value: unknown, what: string): string {
  if (typeof value !== "string") throw invalid(what)
  return value
}
const nullableString = (value: unknown, what: string) => (value === null || value === undefined ? null : string(value, what))
function boolean(value: unknown, what: string): boolean {
  if (typeof value !== "boolean") throw invalid(what)
  return value
}
function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(what)
  return value
}
function oneOf<T extends string>(value: unknown, options: readonly T[], what: string): T {
  if (typeof value !== "string" || !(options as readonly string[]).includes(value)) throw invalid(what)
  return value as T
}

function windowsFromApi(value: unknown): TimeWindow[] {
  return list(value, "windows").map((window) => {
    if (!isRecord(window)) throw invalid("window")
    const start = string(window.start, "window start")
    const end = string(window.end, "window end")
    if (parseLocalTime(start) === null || parseLocalTime(end) === null) throw invalid("window time")
    return { start, end }
  })
}

const orderTypesFromApi = (value: unknown): OrderType[] => {
  const types = list(value, "orderTypes").map((type) => fromApiOrderType(string(type, "order type")))
  return ORDER_TYPES.filter((type) => types.includes(type))
}

/** A record keyed by API order-type names, with every order type present. */
function byOrderTypeFromApi<Value>(value: unknown, read: (raw: unknown) => Value): Record<OrderType, Value> {
  if (!isRecord(value)) throw invalid("byOrderType")
  const result: Partial<Record<OrderType, Value>> = {}
  for (const [key, raw] of Object.entries(value)) result[fromApiOrderType(key)] = read(raw)
  const missing = ORDER_TYPES.filter((type) => result[type] === undefined)
  if (missing.length) throw invalid(`missing order types ${missing.join(", ")}`)
  return result as Record<OrderType, Value>
}

export function actorFromApi(value: unknown): Actor {
  if (!isRecord(value)) throw invalid("actor")
  if (value.kind === "system") return { kind: "system" }
  if (value.kind === "staff" && isRecord(value.staff)) {
    return { kind: "staff", staff: { id: string(value.staff.id, "staff id"), name: string(value.staff.name, "staff name") } }
  }
  throw invalid("actor")
}
const nullableActor = (value: unknown) => (value === null || value === undefined ? null : actorFromApi(value))

function dayRulesFromApi(value: unknown): DayRule[] {
  return list(value, "rules").map((rule) => {
    if (!isRecord(rule)) throw invalid("rule")
    const days = list(rule.days, "days").map((day) => oneOf<Weekday>(day, WEEKDAYS, "weekday"))
    return { days, allDay: boolean(rule.allDay, "allDay"), windows: windowsFromApi(rule.windows) }
  })
}

export function weeklyHoursFromApi(value: unknown): WeeklyHours {
  if (!isRecord(value)) throw invalid("hours")
  return {
    timeZone: string(value.timeZone, "timeZone"),
    byOrderType: byOrderTypeFromApi(value.byOrderType, dayRulesFromApi),
    version: string(value.version, "version"),
    updatedAt: nullableString(value.updatedAt, "updatedAt"),
    updatedBy: nullableActor(value.updatedBy),
  }
}

export function specialDateFromApi(value: unknown): SpecialDate {
  if (!isRecord(value)) throw invalid("special date")
  const date = string(value.date, "date")
  if (!isCalendarDate(date)) throw invalid("date")
  return {
    id: string(value.id, "id"),
    date,
    orderTypes: orderTypesFromApi(value.orderTypes),
    kind: oneOf(value.kind, SPECIAL_DATE_KINDS, "kind"),
    allDay: boolean(value.allDay, "allDay"),
    windows: windowsFromApi(value.windows),
    note: nullableString(value.note, "note"),
    editable: boolean(value.editable, "editable"),
    version: string(value.version, "version"),
    createdAt: string(value.createdAt, "createdAt"),
    createdBy: actorFromApi(value.createdBy),
    updatedAt: string(value.updatedAt, "updatedAt"),
    updatedBy: actorFromApi(value.updatedBy),
  }
}

export function pauseFromApi(value: unknown): PauseState {
  if (!isRecord(value)) throw invalid("pause")
  if (value.paused === false) {
    return {
      paused: false,
      lastResumedAt: nullableString(value.lastResumedAt, "lastResumedAt"),
      lastResumedBy: nullableActor(value.lastResumedBy),
    }
  }
  if (value.paused !== true) throw invalid("paused")
  return {
    paused: true,
    duration: oneOf(value.duration, PAUSE_DURATIONS, "duration"),
    since: string(value.since, "since"),
    until: nullableString(value.until, "until"),
    untilLocal: nullableString(value.untilLocal, "untilLocal"),
    timeZone: string(value.timeZone, "timeZone"),
    reason: nullableString(value.reason, "reason"),
    by: actorFromApi(value.by),
  }
}

const SERVER_STATES = ["open", "closed", "paused"] as const
const SERVER_REASONS = ["weekly_hours", "special_date", "paused", "no_hours_set", "all_day"] as const

function orderTypeStatusFromApi(value: unknown): OrderTypeStatus {
  if (!isRecord(value) || !isRecord(value.immediate)) throw invalid("status")
  const scheduled = value.scheduled
  return {
    immediate: {
      state: oneOf(value.immediate.state, SERVER_STATES, "state"),
      reason: oneOf<ImmediateReason>(value.immediate.reason, SERVER_REASONS, "reason"),
      until: nullableString(value.immediate.until, "until"),
      nextOpening: nullableString(value.immediate.nextOpening, "nextOpening"),
    },
    // P-2: absent means the backend makes no statement about scheduled orders.
    scheduled:
      scheduled === null || scheduled === undefined
        ? null
        : isRecord(scheduled)
          ? { accepting: boolean(scheduled.accepting, "scheduled.accepting") }
          : (() => {
              throw invalid("scheduled")
            })(),
  }
}

export function statusFromApi(value: unknown): AvailabilityStatus {
  if (!isRecord(value)) throw invalid("status")
  return {
    asOf: string(value.asOf, "asOf"),
    timeZone: string(value.timeZone, "timeZone"),
    // The API is always the server; only the preview source produces estimates.
    source: "server",
    pause: pauseFromApi(value.pause),
    byOrderType: byOrderTypeFromApi(value.byOrderType, orderTypeStatusFromApi),
  }
}

export function commandResultFromApi(command: HoursCommand, value: unknown): HoursCommandResult {
  switch (command.type) {
    case "save_hours":
      return { kind: "hours", hours: weeklyHoursFromApi(value) }
    case "add_special_date":
    case "update_special_date":
      return { kind: "special_date", specialDate: specialDateFromApi(value) }
    case "delete_special_date":
      // 204 No Content: nothing to read.
      return { kind: "special_date_deleted", id: command.id, date: "" }
    case "pause":
    case "resume":
      return { kind: "pause", pause: pauseFromApi(value) }
  }
}

// ----- Requests ---------------------------------------------------------------

const keyedToApi = <Value>(record: Record<OrderType, Value>) =>
  Object.fromEntries(ORDER_TYPES.map((type) => [toApiOrderType(type), record[type]]))

/** The request body for a command, with order types in API names. */
export function commandBodyToApi(command: HoursCommand): unknown {
  switch (command.type) {
    case "save_hours":
      return { byOrderType: keyedToApi(hoursFromDraft(command.draft)) }
    case "add_special_date":
    case "update_special_date": {
      const fields = specialDateFields(command.draft)
      return { ...fields, orderTypes: fields.orderTypes.map(toApiOrderType) }
    }
    case "pause":
      return { duration: command.duration, reason: command.reason || null }
    case "delete_special_date":
    case "resume":
      return undefined
  }
}
