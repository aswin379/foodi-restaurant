import { ServiceError } from "@/lib/data-source/errors"

import type { ReviewCommand } from "./commands"
import type { Review } from "./types"

// What a restaurant may do with a review. Used by the screens (to decide which
// controls to offer), by the preview source, and mirrored by the backend,
// which stays authoritative: a hidden control is not security.

/** R6: a reply is a one-time action. Once recorded there is no second reply, edit or delete. */
export const canReply = (review: Pick<Review, "reply">) => review.reply === null

/** One report per review from this restaurant; whether Foodi acts on it isn't known here (R8). */
export const canReport = (review: Pick<Review, "report">) => review.report === null

/**
 * Applies a command to a review and returns the updated review. A command
 * that doesn't fit the review's current state is refused with a message for
 * the user. It never changes the rating, text, moderation status or
 * visibility: a report is not a moderation decision (R8), and a new reply has
 * no publication status until the source supplies one (R7).
 */
export function applyReviewCommand(review: Review, command: ReviewCommand, now: Date): Review {
  switch (command.type) {
    case "reply":
      if (!canReply(review)) {
        throw new ServiceError("conflict", "Review already has a reply.", undefined, "This review already has a reply. A reply can't be edited or deleted here.")
      }
      return { ...review, reply: { text: command.text, repliedAt: now.toISOString(), publication: null } }
    case "report_abuse":
      if (!canReport(review)) {
        throw new ServiceError("conflict", "Review already reported.", undefined, "You've already reported this review.")
      }
      return { ...review, report: { reportedAt: now.toISOString(), reason: command.reason, note: command.note || null } }
  }
}
