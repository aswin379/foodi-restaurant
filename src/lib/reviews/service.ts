import "server-only"

import { connection } from "next/server"

import { ServiceError } from "@/lib/data-source/errors"
import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { ReviewsAdapter } from "./adapter"
import { apiReviewsAdapter } from "./api-source"
import type { ReviewCommand } from "./commands"
import {
  createPreviewReviewsAdapter,
  previewActionRefusal,
  resetPreviewReviews,
  setPreviewActionRefusal,
} from "./preview-source"
import type { Review, ReviewListQuery, ReviewListResult } from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_REVIEWS_DATA_SOURCE=preview) and is refused in production builds:
 * there it resolves to the API whatever the variable says. There is no
 * fallback: if the API fails, the UI shows an error.
 */
function reviews(): { mode: DataSourceMode; adapter: ReviewsAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_REVIEWS_DATA_SOURCE,
    api: apiReviewsAdapter,
    preview: createPreviewReviewsAdapter,
  })
}

export function reviewsMode(): DataSourceMode {
  return reviews().mode
}

export async function getReviewsContext(): Promise<RestaurantContext> {
  await connection()
  return reviews().adapter.context()
}

export async function listReviews(query: ReviewListQuery, previewScenario?: unknown): Promise<ReviewListResult> {
  await connection()
  return reviews().adapter.list(query, previewScenario)
}

/** Returns null when the review doesn't exist for this restaurant. */
export async function getReview(reviewId: string, previewScenario?: unknown): Promise<Review | null> {
  await connection()
  return reviews().adapter.get(reviewId, previewScenario)
}

export async function performReviewCommand(reviewId: string, command: ReviewCommand, idempotencyKey: string): Promise<Review> {
  return reviews().adapter.act(reviewId, command, idempotencyKey)
}

function assertPreviewMode() {
  if (reviews().mode !== "preview") {
    throw new ServiceError("forbidden", "Preview controls are only available in preview mode.")
  }
}

export async function resetReviewsPreview(): Promise<void> {
  assertPreviewMode()
  resetPreviewReviews()
}

/** Preview tool: whether replies and reports are refused as for a non-owner (R9). */
export function reviewsPreviewRefusesActions(): boolean {
  assertPreviewMode()
  return previewActionRefusal()
}

export async function setReviewsPreviewActionRefusal(refuseActions: boolean): Promise<void> {
  assertPreviewMode()
  setPreviewActionRefusal(refuseActions)
}
