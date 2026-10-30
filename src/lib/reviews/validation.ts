// Shared by the reply form (browser) and the Server Action, so both apply the
// same rules (R5). The backend must enforce the authoritative limit; this is
// the UI's copy of it.

export const REVIEW_REPLY_MAX_LENGTH = 1000

const EMPTY_MESSAGE = "Write a reply before sending it."

/** Characters as a person counts them: an emoji is one, not two UTF-16 units. */
export const characterCount = (text: string) => Array.from(text).length

export type ReplyValidation = { ok: true; text: string } | { ok: false; error: string }

/** Trims, then refuses an empty reply or one over the limit. Anything that isn't text is empty. */
export function validateReply(input: unknown): ReplyValidation {
  const text = typeof input === "string" ? input.trim() : ""
  if (text.length === 0) return { ok: false, error: EMPTY_MESSAGE }
  const over = characterCount(text) - REVIEW_REPLY_MAX_LENGTH
  if (over > 0) {
    return {
      ok: false,
      error: `Keep your reply to ${REVIEW_REPLY_MAX_LENGTH.toLocaleString("en")} characters or fewer. It is ${over.toLocaleString("en")} over.`,
    }
  }
  return { ok: true, text }
}

/** Characters left for the counter, measured on the trimmed text that would be sent. Negative = over. */
export const replyCharactersLeft = (input: string) => REVIEW_REPLY_MAX_LENGTH - characterCount(input.trim())
