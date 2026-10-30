"use server"

import { refresh } from "next/cache"

import { isIdempotencyKey } from "@/lib/api/idempotency"
import { actionFailure, runAction, type ActionResult } from "@/lib/data-source/result"
import { parseReviewCommand } from "@/lib/reviews/commands"
import {
  performReviewCommand,
  resetReviewsPreview,
  reviewsMode,
  setReviewsPreviewActionRefusal,
} from "@/lib/reviews/service"
import type { Review } from "@/lib/reviews/types"

// Everything arriving here is untrusted browser input. The command is parsed
// and validated with the same rules as the forms; the data source then
// applies the review rules. Authorization is the backend's: owner-only
// controls in the UI are a convenience, never the check (R9).

const ID_PATTERN = /^[\w-]{1,100}$/

export async function runReviewCommand(input: {
  reviewId: unknown
  command: unknown
  idempotencyKey: unknown
}): Promise<ActionResult<Review>> {
  if (typeof input.reviewId !== "string" || !ID_PATTERN.test(input.reviewId)) return actionFailure("not_found")
  if (!isIdempotencyKey(input.idempotencyKey)) return actionFailure("validation")
  const parsed = parseReviewCommand(input.command)
  if (!parsed.ok) return actionFailure("validation", parsed.fieldErrors)

  const reviewId = input.reviewId
  const idempotencyKey = input.idempotencyKey
  const result = await runAction(reviewsMode(), () => performReviewCommand(reviewId, parsed.command, idempotencyKey))
  if (result.ok) refresh()
  return result
}

/** Preview only: restores the starting sample reviews. Refused outside preview mode. */
export async function resetPreviewReviews(): Promise<ActionResult> {
  const result = await runAction(reviewsMode(), async () => {
    await resetReviewsPreview()
    return undefined
  })
  if (result.ok) refresh()
  return result
}

/** Preview only: refuse (or allow) replies and reports as the backend will for a non-owner. Refused outside preview mode. */
export async function setPreviewActionRefusal(input: { refuseActions: unknown }): Promise<ActionResult> {
  const result = await runAction(reviewsMode(), async () => {
    await setReviewsPreviewActionRefusal(input.refuseActions === true)
    return undefined
  })
  if (result.ok) refresh()
  return result
}
