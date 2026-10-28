import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { isServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { ReviewsAdapter } from "./adapter"
import { commandBodyToApi, reviewFromApi, reviewListFromApi } from "./api-mapping"

/**
 * Integration point for the Foodi reviews API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Reviews aren't connected yet". Every path and
 * payload here is the PROPOSED contract in docs/reviews-ui.md, not agreed with
 * the backend team. Never fall back to preview data.
 */
const PROPOSED_PATHS = {
  reviews: "/seller/reviews",
  review: (id: string) => `/seller/reviews/${encodeURIComponent(id)}`,
  reply: (id: string) => `/seller/reviews/${encodeURIComponent(id)}/reply`,
  reports: (id: string) => `/seller/reviews/${encodeURIComponent(id)}/reports`,
}

export const apiReviewsAdapter: ReviewsAdapter = {
  context: getRestaurantContext,

  async list(query) {
    return reviewListFromApi(
      await getApiTransport().request<unknown>({
        method: "GET",
        path: PROPOSED_PATHS.reviews,
        query: {
          rating: query.rating === "all" ? undefined : query.rating,
          hasReply: query.replied === "all" ? undefined : String(query.replied === "replied"),
          page: query.page,
          pageSize: query.pageSize,
        },
      })
    )
  },

  async get(reviewId) {
    try {
      return reviewFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.review(reviewId) }))
    } catch (error) {
      if (isServiceError(error) && error.kind === "not_found") return null
      throw error
    }
  },

  async act(reviewId, command, idempotencyKey) {
    return reviewFromApi(
      await getApiTransport().request<unknown>({
        method: "POST",
        path: command.type === "reply" ? PROPOSED_PATHS.reply(reviewId) : PROPOSED_PATHS.reports(reviewId),
        body: commandBodyToApi(command),
        idempotencyKey,
      })
    )
  },
}
