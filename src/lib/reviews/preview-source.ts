import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { ReviewsAdapter } from "./adapter"
import { buildFixtureReviews } from "./fixtures/reviews"
import { applyReviewCommand } from "./rules"
import type { Review, ReviewListResult } from "./types"

// PREVIEW ADAPTER (development only). Reviews live in the in-memory preview
// store: replies and reports change them within this server process, nothing
// reaches Foodi, and everything resets when the server restarts. The store
// refuses to run in production. It never touches orders, menu, hours or
// settings, and a simulated report never hides or removes a review.

/** `?preview=empty|error|slow|forbidden` shows those states without a backend. */
export function parsePreviewScenario(value: unknown) {
  return value === "empty" || value === "error" || value === "slow" || value === "forbidden" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 80)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  if (scenario === "forbidden") throw new ServiceError("forbidden", "Preview scenario: forbidden")
  return scenario
}

const reviews = () => getPreviewCollection<Review>("reviews", () => buildFixtureReviews(Date.now()))
// Results of commands already applied, by idempotency key.
const processed = () =>
  getPreviewCollection<{ id: string; request: string; result: Review }>("reviews.idempotency", () => [])

// Preview tool: refuse replies and reports the way the backend will for someone who isn't the owner (R9).
const previewFlags = () =>
  getPreviewCollection<{ id: "flags"; refuseActions: boolean }>("reviews.preview", () => [{ id: "flags", refuseActions: false }])

export function previewActionRefusal(): boolean {
  return previewFlags().get("flags")?.refuseActions ?? false
}

export function setPreviewActionRefusal(refuseActions: boolean) {
  previewFlags().update("flags", (flags) => ({ ...flags, refuseActions }))
}

export function createPreviewReviewsAdapter(): ReviewsAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async list(query, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const matching = (scenario === "empty" ? [] : reviews().list())
        .filter((review) => query.rating === "all" || review.rating === query.rating)
        .filter((review) => query.replied === "all" || (query.replied === "replied") === (review.reply !== null))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const totalPages = Math.max(1, Math.ceil(matching.length / query.pageSize))
      const page = Math.min(query.page, totalPages)
      const start = (page - 1) * query.pageSize
      const result: ReviewListResult = {
        items: matching.slice(start, start + query.pageSize),
        page,
        pageSize: query.pageSize,
        totalItems: matching.length,
        totalPages,
      }
      return result
    },

    async get(reviewId, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      return scenario === "empty" ? null : reviews().get(reviewId)
    },

    async act(reviewId, command, idempotencyKey) {
      await delay(150)
      // A 403 from the backend carries no wording of its own; the UI shows its standard permission message.
      if (previewActionRefusal()) throw new ServiceError("forbidden", "Preview: refused as for a non-owner")
      const request = JSON.stringify({ reviewId, command })
      const replay = processed().get(idempotencyKey)
      if (replay) {
        if (replay.request !== request) {
          throw new ServiceError("conflict", "This request key was already used for a different change.")
        }
        return replay.result
      }
      const updated = reviews().update(reviewId, (review) => applyReviewCommand(review, command, new Date()))
      processed().insert({ id: idempotencyKey, request, result: updated })
      return updated
    },
  }
}

/** Preview control: restores the starting sample reviews. */
export function resetPreviewReviews() {
  reviews().reset()
  processed().reset()
  previewFlags().reset()
}
