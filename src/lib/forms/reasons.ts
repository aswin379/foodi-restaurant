// Shared rules for "pick a reason" inputs: reject reasons (PRD Q9, still a
// configurable list), restaurant cancellation (§4.3) and sold-out reasons.
// The lists themselves are passed in by each module; none is hard-coded here.

export type ReasonOption = {
  value: string
  label: string
  /** The free-text note becomes mandatory for this reason (e.g. "Other"). */
  requiresNote?: boolean
}

export type ReasonSelection = {
  reason: string | null
  note: string
}

export const REASON_NOTE_MAX_LENGTH = 500

export type ReasonErrors = { reason?: string; note?: string }

export function validateReasonSelection(
  selection: ReasonSelection,
  options: readonly ReasonOption[],
  { required = true }: { required?: boolean } = {}
): ReasonErrors {
  const errors: ReasonErrors = {}
  const option = options.find((candidate) => candidate.value === selection.reason)
  const note = selection.note.trim()

  if (!option) {
    if (required || selection.reason !== null) errors.reason = "Choose a reason."
  } else if (option.requiresNote && note.length === 0) {
    errors.note = "Add a short explanation for this reason."
  }

  if (note.length > REASON_NOTE_MAX_LENGTH) {
    errors.note = `Keep the note under ${REASON_NOTE_MAX_LENGTH} characters.`
  }

  return errors
}

export function hasReasonErrors(errors: ReasonErrors) {
  return Boolean(errors.reason || errors.note)
}
