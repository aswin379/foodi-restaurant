import { ServiceError } from "@/lib/data-source/errors"
import { addDays, localClock, offsetMinutes, startOfLocalDay } from "@/lib/time/calendar"

import { hasErrors, type HoursCommand } from "./commands"
import { specialDateFields, takenOrderTypes, validateSpecialDateDraft } from "./special-dates"
import type { Actor, PauseDuration, PauseState, SpecialDate, WeeklyHours } from "./types"
import { hoursFromDraft, validateHoursDraft } from "./weekly-hours"

// The rules a hours command must satisfy, as one pure function. The preview
// data source uses it to simulate the backend; the real API is expected to
// enforce the same rules (docs/hours-ui.md). The server's clock decides
// "today", past dates and pause expiry (PRD §3.8).

export type HoursState = {
  weekly: WeeklyHours
  specialDates: SpecialDate[]
  pause: PauseState
}

export type HoursCommandResult =
  | { kind: "hours"; hours: WeeklyHours }
  | { kind: "special_date"; specialDate: SpecialDate }
  | { kind: "special_date_deleted"; id: string; date: string }
  | { kind: "pause"; pause: PauseState }

export type HoursContext = {
  now: Date
  actor: Actor
  timeZone: string
  newId: (kind: string) => string
}

const refuse = (message: string, fieldErrors?: Record<string, string>) =>
  new ServiceError("conflict", message, fieldErrors, message)

const DURATION_MINUTES: Partial<Record<PauseDuration, number>> = { "15m": 15, "30m": 30, "1h": 60 }

/** "2026-10-25T00:00+05:30": an instant as local wall time with its offset. */
export function localIsoMinutes(instant: Date, timeZone: string) {
  const { date, minutes } = localClock(instant, timeZone)
  const offset = offsetMinutes(instant.getTime(), timeZone)
  const pad = (value: number) => String(value).padStart(2, "0")
  const sign = offset < 0 ? "-" : "+"
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

/**
 * When a pause ends. "Rest of today" (P-1) ends at the restaurant's next local
 * midnight, so it never runs into the next calendar day; daylight saving is
 * handled by the zone's own rules.
 */
export function pauseEnd(duration: PauseDuration, now: Date, timeZone: string): Date | null {
  if (duration === "until_resumed") return null
  if (duration === "rest_of_today") return startOfLocalDay(addDays(localClock(now, timeZone).date, 1), timeZone)
  return new Date(now.getTime() + DURATION_MINUTES[duration]! * 60_000)
}

/** A pause whose end has passed is over; the automatic resume is attributed to the system. */
export function expirePause(pause: PauseState, now: Date): PauseState {
  if (!pause.paused || pause.until === null || new Date(pause.until).getTime() > now.getTime()) return pause
  return { paused: false, lastResumedAt: pause.until, lastResumedBy: { kind: "system" } }
}

/** Special dates as a reader sees them: past ones not editable. */
export function withEditable(specialDates: SpecialDate[], today: string): SpecialDate[] {
  return specialDates
    .map((specialDate) => ({ ...specialDate, editable: specialDate.date >= today }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const nextVersion = (version: string) => {
  const match = /^(.*-)(\d+)$/.exec(version)
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${version}-2`
}

export function applyHoursCommand(
  current: HoursState,
  command: HoursCommand,
  context: HoursContext
): { state: HoursState; result: HoursCommandResult } {
  const now = context.now.toISOString()
  const today = localClock(context.now, context.timeZone).date
  const state = { ...current, pause: expirePause(current.pause, context.now) }

  switch (command.type) {
    case "save_hours": {
      if (command.version !== state.weekly.version) {
        throw refuse("Hours were changed by someone else. Reload to see the latest.")
      }
      const errors = validateHoursDraft(command.draft)
      if (hasErrors(errors)) throw new ServiceError("validation", "Invalid hours.", errors)
      const weekly: WeeklyHours = {
        ...state.weekly,
        byOrderType: hoursFromDraft(command.draft),
        version: nextVersion(state.weekly.version),
        updatedAt: now,
        updatedBy: context.actor,
      }
      return { state: { ...state, weekly }, result: { kind: "hours", hours: weekly } }
    }

    case "add_special_date":
    case "update_special_date": {
      const existing = command.type === "update_special_date" ? findSpecialDate(state, command.id) : null
      if (existing && command.type === "update_special_date") {
        if (existing.date < today) throw refuse("Past special dates can't be changed.")
        if (existing.version !== command.version) {
          throw refuse("This special date was changed by someone else. Reload to see the latest.")
        }
      }
      const others = state.specialDates.filter((candidate) => candidate.id !== existing?.id)
      const errors = validateSpecialDateDraft(command.draft, { today, others })
      if (hasErrors(errors)) {
        // Another special date for the same date and order type is a conflict with that
        // record (contract: 409 duplicate_special_date); everything else is an input error.
        const duplicateOnly = takenOrderTypes(command.draft, others).length > 0 && Object.keys(errors).length === 1
        if (duplicateOnly) throw refuse(errors["specialDate.orderTypes"], errors)
        throw new ServiceError("validation", "Invalid special date.", errors)
      }
      const fields = specialDateFields(command.draft)
      const specialDate: SpecialDate = existing
        ? { ...existing, ...fields, editable: true, version: nextVersion(existing.version), updatedAt: now, updatedBy: context.actor }
        : (() => {
            const id = context.newId("spd")
            return {
              id,
              ...fields,
              editable: true,
              version: `${id}-1`,
              createdAt: now,
              createdBy: context.actor,
              updatedAt: now,
              updatedBy: context.actor,
            }
          })()
      return {
        state: { ...state, specialDates: [...others, specialDate] },
        result: { kind: "special_date", specialDate },
      }
    }

    case "delete_special_date": {
      const existing = findSpecialDate(state, command.id)
      if (existing.date < today) throw refuse("Past special dates can't be removed.")
      if (existing.version !== command.version) {
        throw refuse("This special date was changed by someone else. Reload to see the latest.")
      }
      return {
        state: { ...state, specialDates: state.specialDates.filter((candidate) => candidate.id !== existing.id) },
        result: { kind: "special_date_deleted", id: existing.id, date: existing.date },
      }
    }

    case "pause": {
      if (state.pause.paused) throw refuse("The restaurant is already paused. Resume it first to choose another duration.")
      const until = pauseEnd(command.duration, context.now, context.timeZone)
      const pause: PauseState = {
        paused: true,
        duration: command.duration,
        since: now,
        until: until?.toISOString() ?? null,
        untilLocal: until ? localIsoMinutes(until, context.timeZone) : null,
        timeZone: context.timeZone,
        reason: command.reason || null,
        by: context.actor,
      }
      return { state: { ...state, pause }, result: { kind: "pause", pause } }
    }

    case "resume": {
      // Resuming when not paused changes nothing (idempotent).
      if (!state.pause.paused) return { state, result: { kind: "pause", pause: state.pause } }
      const pause: PauseState = { paused: false, lastResumedAt: now, lastResumedBy: context.actor }
      return { state: { ...state, pause }, result: { kind: "pause", pause } }
    }
  }
}

function findSpecialDate(state: HoursState, id: string) {
  const found = state.specialDates.find((candidate) => candidate.id === id)
  if (!found) throw new ServiceError("not_found", "Special date not found.", undefined, "This special date no longer exists.")
  return found
}
