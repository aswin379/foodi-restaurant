// Reviews model (B6a, PRD §1 module 13, §6 Reviews). The PRD names no fields,
// so this model is a PROPOSAL (docs/reviews-ui.md): the smallest shape the
// approved decisions R1–R9 need. Review creation isn't part of the restaurant
// panel; these screens manage reviews that already exist.

/** R1: a five-star scale of whole numbers. */
export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const
export type ReviewRating = (typeof REVIEW_RATINGS)[number]

export function isReviewRating(value: unknown): value is ReviewRating {
  return typeof value === "number" && (REVIEW_RATINGS as readonly number[]).includes(value)
}

/**
 * R7: shown only when the source supplies it. A review with no status says
 * nothing about visibility; the panel never assumes one.
 */
export const REVIEW_MODERATION_STATUSES = ["published", "under_review", "hidden"] as const
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number]

export const reviewModerationLabels: Record<ReviewModerationStatus, string> = {
  published: "Published",
  under_review: "Under review by Foodi",
  hidden: "Hidden from customers",
}

/** R7: likewise for a reply. A reply with no status is never described as visible or approved. */
export const REPLY_PUBLICATION_STATUSES = ["published", "pending_approval", "not_published"] as const
export type ReplyPublicationStatus = (typeof REPLY_PUBLICATION_STATUSES)[number]

export const replyPublicationLabels: Record<ReplyPublicationStatus, string> = {
  published: "Visible to customers",
  pending_approval: "Waiting for approval",
  not_published: "Not published",
}

export type ReviewReply = {
  text: string
  /** UTC instant. */
  repliedAt: string
  publication: ReplyPublicationStatus | null
}

/** A report from this restaurant. A report is not a moderation decision (R8). */
export type ReviewReport = {
  reportedAt: string
  /** A reason value from REVIEW_REPORT_REASONS (reasons.ts). */
  reason: string
  note: string | null
}

/** R4: present only when the review data carries a well-formed order reference. */
export type ReviewOrderLink = {
  id: string
  reference: string
}

export type Review = {
  id: string
  rating: ReviewRating
  /** R2: optional. Null is a rating-only review. */
  text: string | null
  /** R3: a display name only. Null when the customer's name isn't shared. */
  reviewerName: string | null
  /** UTC instant. */
  createdAt: string
  /** R6: a reply is recorded once; there is no edit or delete. */
  reply: ReviewReply | null
  moderation: ReviewModerationStatus | null
  report: ReviewReport | null
  order: ReviewOrderLink | null
}

export const REVIEW_REPLIED_FILTERS = ["all", "replied", "unreplied"] as const
export type ReviewRepliedFilter = (typeof REVIEW_REPLIED_FILTERS)[number]

export type ReviewListQuery = {
  rating: ReviewRating | "all"
  replied: ReviewRepliedFilter
  page: number
  pageSize: number
}

export type ReviewListResult = {
  items: Review[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export const ratingText = (rating: ReviewRating) => `${rating} out of 5 stars`
