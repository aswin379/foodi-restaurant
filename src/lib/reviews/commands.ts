import { validateReasonSelection } from "@/lib/forms/reasons"

import { REVIEW_REPORT_REASONS } from "./reasons"
import { validateReply } from "./validation"

// Restaurant commands on a review. Server Actions parse untrusted browser
// input with parseReviewCommand; the rules (rules.ts, or the backend) then
// decide whether the command fits the review's current state.

export type ReviewCommand =
  | { type: "reply"; text: string }
  | { type: "report_abuse"; reason: string; note: string }

export type ReviewFieldErrors = Record<string, string>
export type ParsedReviewCommand = { ok: true; command: ReviewCommand } | { ok: false; fieldErrors: ReviewFieldErrors }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const unknownCommand: ParsedReviewCommand = { ok: false, fieldErrors: { command: "Unknown action." } }

export function parseReviewCommand(input: unknown): ParsedReviewCommand {
  if (!isRecord(input)) return unknownCommand

  switch (input.type) {
    case "reply": {
      const reply = validateReply(input.text)
      return reply.ok ? { ok: true, command: { type: "reply", text: reply.text } } : { ok: false, fieldErrors: { text: reply.error } }
    }
    case "report_abuse": {
      const reason = typeof input.reason === "string" ? input.reason : null
      const note = typeof input.note === "string" ? input.note : ""
      // R8: a reason is required, and "Other" needs a note.
      const errors = validateReasonSelection({ reason, note }, REVIEW_REPORT_REASONS)
      if (errors.reason || errors.note) {
        return { ok: false, fieldErrors: { ...(errors.reason ? { reason: errors.reason } : {}), ...(errors.note ? { note: errors.note } : {}) } }
      }
      return { ok: true, command: { type: "report_abuse", reason: reason!, note: note.trim() } }
    }
    default:
      return unknownCommand
  }
}
