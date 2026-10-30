import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { isServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { PromotionsAdapter } from "./adapter"
import { promotionFromApi, promotionListFromApi } from "./api-mapping"

/**
 * Integration point for the Foodi promotions API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Promotions aren't connected yet". Every path
 * and payload here is the PROPOSED contract in docs/promotions-ui.md: NOT
 * IMPLEMENTED and not agreed with the backend team. Never fall back to preview
 * data. The restaurant comes from the seller session on the server; no
 * restaurant ID is ever taken from the URL or sent by the page, and the
 * backend must enforce authorization and ownership.
 */
const PROPOSED_PATHS = {
  promotions: "/seller/promotions",
  promotion: (id: string) => `/seller/promotions/${encodeURIComponent(id)}`,
}

export const apiPromotionsAdapter: PromotionsAdapter = {
  context: getRestaurantContext,

  async list(query) {
    const { currency } = await getRestaurantContext()
    return promotionListFromApi(
      await getApiTransport().request<unknown>({
        method: "GET",
        path: PROPOSED_PATHS.promotions,
        query: {
          kind: "coupon",
          status: query.status === "all" ? undefined : query.status,
          page: query.page,
          pageSize: query.pageSize,
        },
      }),
      { currency }
    )
  },

  async get(promotionId) {
    const { currency } = await getRestaurantContext()
    try {
      return promotionFromApi(
        await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.promotion(promotionId) }),
        { currency }
      )
    } catch (error) {
      if (isServiceError(error) && error.kind === "not_found") return null
      throw error
    }
  },
}
