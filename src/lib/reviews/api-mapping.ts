import { ServiceError } from "@/lib/data-source/errors"

import type { ReviewCommand } from "./commands"
import {
  isReviewRating,
  REPLY_PUBLICATION_STATUSES,
  REVIEW_MODERATION_STATUSES,
  type ReplyPublicationStatus,
  type Review,
  type ReviewListResult,
  type ReviewModerationStatus,
  type ReviewOrderLink,
  type ReviewReply,
  type ReviewReport,
} from "./types"

// Converts reviews between the PROPOSED API shape (docs/reviews-ui.md) and the
// frontend model. Anything unexpected is an integration error that fails
// visibly: nothing malformed is turned into a default, a status is never
// guessed, and only the fields below are read, so a contact detail the API
// might send alongside a review can't reach the screen (R3).

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid review data from API: ${what}`)

const ID_PATTERN = /^[\w-]{1,100}$/
const MAX_REFERENCE_LENGTH = 40
const absent = (value: unknown) => value === null || value === undefined

function nonEmptyString(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw invalid(what)
  return value
}

/** Absent or null is an explicit "none"; an empty or blank string is malformed, not "none". */
const optionalText = (value: unknown, what: string) => (absent(value) ? null : nonEmptyString(value, what))

function instant(value: unknown, what: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw invalid(what)
  return value
}

function integer(value: unknown, what: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) throw invalid(what)
  return value
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[], what: string): Value {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw invalid(`unknown ${what} ${typeof value === "string" ? value : typeof value}`)
  }
  return value as Value
}

function replyFromApi(value: unknown): ReviewReply | null {
  if (absent(value)) return null
  if (!isRecord(value)) throw invalid("reply")
  const publication: ReplyPublicationStatus | null = absent(value.publication)
    ? null
    : oneOf(value.publication, REPLY_PUBLICATION_STATUSES, "reply status")
  return { text: nonEmptyString(value.text, "reply text"), repliedAt: instant(value.repliedAt, "reply date"), publication }
}

function reportFromApi(value: unknown): ReviewReport | null {
  if (absent(value)) return null
  if (!isRecord(value)) throw invalid("report")
  return {
    reportedAt: instant(value.reportedAt, "report date"),
    reason: nonEmptyString(value.reason, "report reason"),
    note: optionalText(value.note, "report note"),
  }
}

/** R4: a link is shown only for a well-formed reference; a malformed one is an error, never inferred. */
function orderFromApi(value: unknown): ReviewOrderLink | null {
  if (absent(value)) return null
  if (!isRecord(value) || typeof value.id !== "string" || !ID_PATTERN.test(value.id)) throw invalid("order reference")
  const reference = nonEmptyString(value.reference, "order reference")
  if (reference.length > MAX_REFERENCE_LENGTH) throw invalid("order reference")
  return { id: value.id, reference }
}

export function reviewFromApi(value: unknown): Review {
  if (!isRecord(value)) throw invalid("review")
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) throw invalid("id")
  if (!isReviewRating(value.rating)) throw invalid("rating")
  const moderation: ReviewModerationStatus | null = absent(value.moderation)
    ? null
    : oneOf(value.moderation, REVIEW_MODERATION_STATUSES, "moderation status")
  return {
    id: value.id,
    rating: value.rating,
    text: optionalText(value.text, "text"),
    reviewerName: optionalText(value.reviewerName, "reviewerName"),
    createdAt: instant(value.createdAt, "createdAt"),
    reply: replyFromApi(value.reply),
    moderation,
    report: reportFromApi(value.report),
    order: orderFromApi(value.order),
  }
}

export function reviewListFromApi(value: unknown): ReviewListResult {
  if (!isRecord(value) || !Array.isArray(value.items)) throw invalid("review list")
  const pageSize = integer(value.pageSize, "pageSize", 1)
  const items = value.items.map(reviewFromApi)
  if (items.length > pageSize) throw invalid("more reviews than pageSize")
  const totalItems = integer(value.totalItems, "totalItems", 0)
  if (items.length > totalItems) throw invalid("more reviews than totalItems")
  return { items, page: integer(value.page, "page", 1), pageSize, totalItems, totalPages: integer(value.totalPages, "totalPages", 1) }
}

/** A command's request body. */
export function commandBodyToApi(command: ReviewCommand): unknown {
  return command.type === "reply" ? { text: command.text } : { reason: command.reason, note: command.note || null }
}
