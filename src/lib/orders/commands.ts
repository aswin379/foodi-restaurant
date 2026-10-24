import { validateReasonSelection } from "@/lib/forms/reasons"

import { CANCEL_REASONS, REJECT_REASONS } from "./reasons"

// Restaurant commands on an order (PRD §4.2). Input from the browser is
// untrusted: Server Actions run parseOrderCommand before anything else, and
// the lifecycle rules then decide whether the command applies.

/** Preview default until restaurant settings exist (B4). */
export const DEFAULT_PREP_TIME_MINUTES = 20
export const PREP_TIME_PRESETS = [10, 15, 20, 25, 30, 45, 60] as const
export const PREP_TIME_MIN = 5
export const PREP_TIME_MAX = 180
export const PREP_ADJUST_PRESETS = [5, 10] as const
export const PREP_ADJUST_MAX = 120

export type OrderCommand =
  | { type: "accept"; prepTimeMinutes: number }
  | { type: "reject"; reason: string; note: string }
  | { type: "cancel"; reason: string; note: string; riderRecallConfirmed: boolean }
  | { type: "adjust_prep_time"; addMinutes: number }
  | { type: "mark_ready" }
  | { type: "dispatch"; riderId: string }
  | { type: "complete" }

export type OrderCommandType = OrderCommand["type"]

export type ParsedCommand =
  | { ok: true; command: OrderCommand }
  | { ok: false; fieldErrors: Record<string, string> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function wholeNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
}

const text = (value: unknown) => (typeof value === "string" ? value : "")

export function parseOrderCommand(input: unknown): ParsedCommand {
  if (!isRecord(input)) return { ok: false, fieldErrors: { command: "Unknown action." } }

  switch (input.type) {
    case "accept":
      return wholeNumber(input.prepTimeMinutes, PREP_TIME_MIN, PREP_TIME_MAX)
        ? { ok: true, command: { type: "accept", prepTimeMinutes: input.prepTimeMinutes as number } }
        : {
            ok: false,
            fieldErrors: {
              prepTimeMinutes: `Enter a prep time between ${PREP_TIME_MIN} and ${PREP_TIME_MAX} minutes.`,
            },
          }

    case "reject":
    case "cancel": {
      const reason = text(input.reason)
      const note = text(input.note).trim()
      const options = input.type === "reject" ? REJECT_REASONS : CANCEL_REASONS
      const errors = validateReasonSelection({ reason: reason || null, note }, options)
      if (errors.reason || errors.note) {
        return {
          ok: false,
          fieldErrors: {
            ...(errors.reason ? { reason: errors.reason } : {}),
            ...(errors.note ? { note: errors.note } : {}),
          },
        }
      }
      return input.type === "reject"
        ? { ok: true, command: { type: "reject", reason, note } }
        : {
            ok: true,
            command: {
              type: "cancel",
              reason,
              note,
              riderRecallConfirmed: input.riderRecallConfirmed === true,
            },
          }
    }

    case "adjust_prep_time":
      return wholeNumber(input.addMinutes, 1, PREP_ADJUST_MAX)
        ? { ok: true, command: { type: "adjust_prep_time", addMinutes: input.addMinutes as number } }
        : {
            ok: false,
            fieldErrors: { addMinutes: `Add between 1 and ${PREP_ADJUST_MAX} minutes.` },
          }

    case "dispatch": {
      const riderId = text(input.riderId)
      return riderId
        ? { ok: true, command: { type: "dispatch", riderId } }
        : { ok: false, fieldErrors: { riderId: "Choose a rider." } }
    }

    case "mark_ready":
    case "complete":
      return { ok: true, command: { type: input.type } }

    default:
      return { ok: false, fieldErrors: { command: "Unknown action." } }
  }
}
