import type { RestaurantContext } from "@/lib/restaurant/context"

import type { ReviewCommand } from "./commands"
import type { Review, ReviewListQuery, ReviewListResult } from "./types"

/**
 * What the Reviews screens need from a data source. Two implementations: the
 * Foodi API (api-source.ts) and labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type ReviewsAdapter = {
  context(): Promise<RestaurantContext>
  list(query: ReviewListQuery, previewScenario?: unknown): Promise<ReviewListResult>
  /** Null when the review doesn't exist for this restaurant. */
  get(reviewId: string, previewScenario?: unknown): Promise<Review | null>
  /** Applies a restaurant command and returns the updated review. Replays the stored result for a repeated key. */
  act(reviewId: string, command: ReviewCommand, idempotencyKey: string): Promise<Review>
}
