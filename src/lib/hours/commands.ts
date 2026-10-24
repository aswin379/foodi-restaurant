import { specialDateDraftFromInput, type SpecialDateDraft } from "./special-dates"
import { PAUSE_DURATIONS, type PauseDuration } from "./types"
import { hoursDraftFromInput, validateHoursDraft, type HoursDraft } from "./weekly-hours"

// Restaurant commands on hours, special dates and pause. Server Actions parse
// untrusted browser input with parseHoursCommand; the rules (rules.ts, or the
// backend) then decide whether the command fits the current state.

export const PAUSE_REASON_MAX = 200

export type FieldErrors = Record<string, string>
export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0

export type HoursCommand =
  | { type: "save_hours"; version: string; draft: HoursDraft }
  | { type: "add_special_date"; draft: SpecialDateDraft }
  | { type: "update_special_date"; id: string; version: string; draft: SpecialDateDraft }
  | { type: "delete_special_date"; id: string; version: string }
  | { type: "pause"; duration: PauseDuration; reason: string }
  | { type: "resume" }

export type ParsedHoursCommand = { ok: true; command: HoursCommand } | { ok: false; fieldErrors: FieldErrors }

const ID_PATTERN = /^[\w-]{1,100}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const id = (value: unknown) => (typeof value === "string" && ID_PATTERN.test(value) ? value : null)
const unknownCommand: ParsedHoursCommand = { ok: false, fieldErrors: { command: "Unknown action." } }

export function isPauseDuration(value: unknown): value is PauseDuration {
  return typeof value === "string" && (PAUSE_DURATIONS as readonly string[]).includes(value)
}

export function parseHoursCommand(input: unknown): ParsedHoursCommand {
  if (!isRecord(input)) return unknownCommand

  switch (input.type) {
    case "save_hours": {
      const version = id(input.version)
      if (!version) return unknownCommand
      const draft = hoursDraftFromInput(input.draft)
      const errors = validateHoursDraft(draft)
      return hasErrors(errors) ? { ok: false, fieldErrors: errors } : { ok: true, command: { type: "save_hours", version, draft } }
    }

    case "add_special_date":
      // Dates are checked against "today" and other special dates by the rules.
      return { ok: true, command: { type: "add_special_date", draft: specialDateDraftFromInput(input.draft) } }

    case "update_special_date": {
      const specialDateId = id(input.id)
      const version = id(input.version)
      if (!specialDateId || !version) return unknownCommand
      return {
        ok: true,
        command: { type: "update_special_date", id: specialDateId, version, draft: specialDateDraftFromInput(input.draft) },
      }
    }

    case "delete_special_date": {
      const specialDateId = id(input.id)
      const version = id(input.version)
      return specialDateId && version
        ? { ok: true, command: { type: "delete_special_date", id: specialDateId, version } }
        : unknownCommand
    }

    case "pause": {
      if (!isPauseDuration(input.duration)) return { ok: false, fieldErrors: { duration: "Choose how long to pause." } }
      const reason = typeof input.reason === "string" ? input.reason.slice(0, 1000).trim() : ""
      if (reason.length > PAUSE_REASON_MAX) {
        return { ok: false, fieldErrors: { reason: `Keep the reason under ${PAUSE_REASON_MAX} characters.` } }
      }
      return { ok: true, command: { type: "pause", duration: input.duration, reason } }
    }

    case "resume":
      return { ok: true, command: { type: "resume" } }

    default:
      return unknownCommand
  }
}
