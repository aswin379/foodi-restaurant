"use client"

import { useCallback, useRef, useState, useTransition } from "react"

import { runReviewCommand } from "@/app/(dashboard)/reviews/actions"
import { notifyActionResult } from "@/components/shared/notifications"
import { createIdempotencyKey } from "@/lib/api/idempotency"
import { actionFailure, type ActionResult } from "@/lib/data-source/result"
import type { ReviewCommand } from "@/lib/reviews/commands"
import type { Review } from "@/lib/reviews/types"

/** Shown when the request itself fails (offline, server error): the action never answered. */
export const REQUEST_FAILED_MESSAGE =
  "Your request couldn't be sent, so nothing was changed. Check your connection and try again."

/**
 * Runs one restaurant command on a review. A key is made per distinct request
 * and kept when it fails, so retrying the same reply or report can't apply it
 * twice; a changed request gets a new key, because a key belongs to one
 * request. A request that fails before the action answers becomes an ordinary
 * failure: nothing is reported as done and no success notification is shown.
 */
export function useReviewCommand(reviewId: string) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult<Review> | null>(null)
  const attempt = useRef<{ request: string; key: string } | null>(null)

  const reset = useCallback(() => {
    attempt.current = null
    setResult(null)
  }, [])

  const run = useCallback(
    (command: ReviewCommand, successText: string, onSuccess?: () => void) => {
      const request = JSON.stringify(command)
      if (attempt.current?.request !== request) attempt.current = { request, key: createIdempotencyKey() }
      const idempotencyKey = attempt.current.key
      startTransition(async () => {
        let outcome: ActionResult<Review>
        try {
          outcome = await runReviewCommand({ reviewId, command, idempotencyKey })
        } catch {
          outcome = actionFailure("unavailable", undefined, REQUEST_FAILED_MESSAGE)
        }
        setResult(outcome)
        if (outcome.ok) {
          attempt.current = null
          notifyActionResult(outcome, { success: successText })
          onSuccess?.()
        }
      })
    },
    [reviewId]
  )

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {}
  return { pending, result, fieldErrors, run, reset }
}
