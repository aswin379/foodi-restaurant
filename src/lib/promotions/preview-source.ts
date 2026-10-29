import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { PromotionsAdapter } from "./adapter"
import { buildFixturePromotions } from "./fixtures/promotions"
import type { Promotion, PromotionListResult } from "./types"

// PREVIEW ADAPTER (development only). Read-only, obviously fictional sample
// coupons in the in-memory preview store, which refuses to run in production.
// It plays the server for the status filter and pagination only, in the order
// the fixtures list them; none of it is evidence of how a real promotions
// service filters, orders or reports anything.

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

const promotions = () => getPreviewCollection<Promotion>("promotions", () => buildFixturePromotions(Date.now()))

export function createPreviewPromotionsAdapter(): PromotionsAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async list(query, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      // The filter matches the status the fixture reports. A coupon reporting none appears only under "all".
      const matching = (scenario === "empty" ? [] : promotions().list()).filter(
        (promotion) => query.status === "all" || promotion.status === query.status
      )
      const totalPages = Math.max(1, Math.ceil(matching.length / query.pageSize))
      const page = Math.min(query.page, totalPages)
      const start = (page - 1) * query.pageSize
      const result: PromotionListResult = {
        items: matching.slice(start, start + query.pageSize),
        page,
        pageSize: query.pageSize,
        totalItems: matching.length,
        totalPages,
        hasNextPage: page < totalPages,
      }
      return result
    },

    async get(promotionId, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      return scenario === "empty" ? null : promotions().get(promotionId)
    },
  }
}
