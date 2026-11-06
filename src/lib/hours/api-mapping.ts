import { fromApiOrderType } from "@/lib/api/mapping"
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
  type ImmediateState,
  type OrderTypeStatus,
  type PauseState,
  type SpecialDate,
  type WeeklyHours,
} from "./types"
import { hoursFromDraft } from "./weekly-hours"
import { isRecord } from "@/lib/api/guards"

// Converts hours data between the PROPOSED API shape (docs/hours-ui.md) and
// the frontend model. Order types appear as record keys (`byOrderType`) and
// as values (`orderTypes`); both go through src/lib/api/mapping.ts. Anything
// unexpected in a response is an integration error, never guessed at.

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
  const types = list(value, "orderTypes").map((type) => {
    const name = string(type, "order type")
    return (DELIVERY_MODES_API as readonly string[]).includes(name) ? "delivery" : fromApiOrderType(name)
  })
  return ORDER_TYPES.filter((type) => types.includes(type))
}

// The server names weekdays in full ("monday") and splits delivery into two modes. The page
// has one Delivery tab, so the two modes are folded into it here and written back to both.
const API_WEEKDAYS: Record<string, Weekday> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
}
const toApiWeekday = (day: Weekday) => Object.keys(API_WEEKDAYS).find((key) => API_WEEKDAYS[key] === day)!

export const DELIVERY_MODES_API = ["foodi_delivery", "seller_delivery"] as const

/** The API type that stands for a tab when reading: the first enabled delivery mode. */
function readKey(record: Record<string, unknown>, enabled: Record<string, boolean>): Record<OrderType, unknown> {
  const mode = DELIVERY_MODES_API.find((key) => enabled[key]) ?? DELIVERY_MODES_API[0]
  return { delivery: record[mode] ?? record.delivery, takeaway: record.takeaway, dine_in: record.dine_in }
}

export function actorFromApi(value: unknown): Actor {
  if (!isRecord(value)) throw invalid("actor")
  if (value.kind === "system") return { kind: "system" }
  if ((value.kind === "staff" || value.kind === "admin") && isRecord(value.staff)) {
    return { kind: "staff", staff: { id: string(value.staff.id, "staff id"), name: string(value.staff.name, "staff name") } }
  }
  throw invalid("actor")
}
const nullableActor = (value: unknown) => (value === null || value === undefined ? null : actorFromApi(value))

/** Weekly day rules (also used for meal-period times, B3b). */
export function dayRulesFromApi(value: unknown): DayRule[] {
  return list(value, "rules").map((rule) => {
    if (!isRecord(rule)) throw invalid("rule")
    const days = list(rule.days, "days").map((day) =>
      typeof day === "string" && day in API_WEEKDAYS ? API_WEEKDAYS[day] : oneOf<Weekday>(day, WEEKDAYS, "weekday")
    )
    return { days, allDay: boolean(rule.allDay, "allDay"), windows: windowsFromApi(rule.windows) }
  })
}

export function weeklyHoursFromApi(value: unknown): WeeklyHours {
  if (!isRecord(value)) throw invalid("hours")
  if (!isRecord(value.byOrderType)) throw invalid("byOrderType")
  const enabled = isRecord(value.enabledTypes) ? (value.enabledTypes as Record<string, boolean>) : {}
  const folded = readKey(value.byOrderType, enabled)
  for (const type of ORDER_TYPES) if (folded[type] === undefined) throw invalid(`missing order type ${type}`)
  return {
    timeZone: string(value.timeZone, "timeZone"),
    byOrderType: {
      delivery: dayRulesFromApi(folded.delivery),
      takeaway: dayRulesFromApi(folded.takeaway),
      dine_in: dayRulesFromApi(folded.dine_in),
    },
    enabledTypes: isRecord(value.enabledTypes)
      ? {
          delivery: Boolean(enabled.foodi_delivery) || Boolean(enabled.seller_delivery) || Boolean(enabled.delivery),
          takeaway: Boolean(enabled.takeaway),
          dine_in: Boolean(enabled.dine_in),
        }
      : undefined,
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
    scope: typeof value.scope === "string" ? value.scope : undefined,
    duration: oneOf(value.duration, PAUSE_DURATIONS, "duration"),
    since: string(value.since, "since"),
    until: nullableString(value.until, "until"),
    untilLocal: nullableString(value.untilLocal, "untilLocal"),
    timeZone: string(value.timeZone, "timeZone"),
    reason: nullableString(value.reason, "reason"),
    by: actorFromApi(value.by),
  }
}

const STATE_BY_API: Record<string, ImmediateState> = {
  OPEN: "open",
  CLOSING_SOON: "open",
  CLOSED: "closed",
  UNAVAILABLE: "closed",
  PAUSED: "paused",
}
const REASON_BY_API: Record<string, ImmediateReason> = {
  OPEN_WEEKLY: "weekly_hours",
  OPEN_SPECIAL_HOURS: "special_date",
  SPECIAL_DATE_CLOSED: "special_date",
  SPECIAL_HOURS_OUTSIDE: "special_date",
  PAUSED: "paused",
  NO_HOURS_SET: "no_hours_set",
}

/** One engine result (snake_case, from the server) as the page model. */
function orderTypeStatusFromApi(value: unknown): OrderTypeStatus {
  if (!isRecord(value)) throw invalid("status")
  const state = STATE_BY_API[string(value.status, "status")]
  if (!state) throw invalid("status")
  return {
    immediate: {
      state,
      reason: REASON_BY_API[string(value.reason_code, "reason_code")] ?? "weekly_hours",
      until: nullableString(value.closes_at, "closes_at") ?? nullableString(value.resumes_at, "resumes_at"),
      nextOpening: nullableString(value.next_opens_at, "next_opens_at"),
    },
    scheduled: typeof value.accepts_scheduled === "boolean" ? { accepting: value.accepts_scheduled } : null,
  }
}

/** Delivery tab = the delivery mode that is switched on (the first one that is not TYPE_DISABLED). */
function foldStatuses(value: unknown): Record<OrderType, OrderTypeStatus> {
  if (!isRecord(value)) throw invalid("byOrderType")
  const modes = DELIVERY_MODES_API.map((key) => value[key]).filter(isRecord)
  const enabledMode = modes.find((mode) => mode.reason_code !== "TYPE_DISABLED") ?? modes[0] ?? value.delivery
  const raw = { delivery: enabledMode, takeaway: value.takeaway, dine_in: value.dine_in }
  for (const type of ORDER_TYPES) if (raw[type] === undefined) throw invalid(`missing order type ${type}`)
  return { delivery: orderTypeStatusFromApi(raw.delivery), takeaway: orderTypeStatusFromApi(raw.takeaway), dine_in: orderTypeStatusFromApi(raw.dine_in) }
}

export function statusFromApi(value: unknown, pauseByType?: Partial<Record<OrderType, PauseState>>): AvailabilityStatus {
  if (!isRecord(value)) throw invalid("status")
  return {
    asOf: string(value.asOf, "asOf"),
    timeZone: string(value.timeZone, "timeZone"),
    // The API is always the server; only the preview source produces estimates.
    source: "server",
    pause: pauseFromApi(value.pause),
    ...(pauseByType ? { pauseByType } : {}),
    byOrderType: foldStatuses(value.byOrderType),
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

/** The page scope of a tab as the API names it ("delivery" covers both delivery modes). */
export const apiPauseScope = (scope: OrderType | undefined) => scope ?? "all"

function rulesToApi(rules: DayRule[]) {
  return rules.map((rule) => ({ ...rule, days: rule.days.map(toApiWeekday) }))
}

/**
 * The request body for a command. Delivery hours are written to every enabled delivery mode, so
 * the caller passes the modes read from the server, never from the browser.
 */
export function commandBodyToApi(command: HoursCommand, deliveryModes: readonly string[] = DELIVERY_MODES_API): unknown {
  switch (command.type) {
    case "save_hours": {
      const rules = hoursFromDraft(command.draft)
      const types = command.scope ? [command.scope] : ORDER_TYPES
      const byOrderType: Record<string, unknown> = {}
      for (const type of types) {
        if (type === "delivery") for (const mode of deliveryModes) byOrderType[mode] = rulesToApi(rules.delivery)
        else byOrderType[type] = rulesToApi(rules[type])
      }
      return { byOrderType }
    }
    case "add_special_date":
    case "update_special_date": {
      const fields = specialDateFields(command.draft)
      return { ...fields, orderTypes: fields.orderTypes.flatMap((type) => (type === "delivery" ? [...deliveryModes] : [type])) }
    }
    case "pause":
      return { duration: command.duration, reason: command.reason || null, orderType: apiPauseScope(command.scope) }
    case "delete_special_date":
    case "resume":
      return undefined
  }
}
