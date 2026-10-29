import type { RestaurantContext } from "@/lib/restaurant/context"

import type { Promotion, PromotionListQuery, PromotionListResult } from "./types"

/**
 * What the Promotions screens need from a data source. Read-only: B6e has no
 * create, edit, delete, activate or pause action. Two implementations: the
 * Foodi API (api-source.ts) and labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type PromotionsAdapter = {
  context(): Promise<RestaurantContext>
  list(query: PromotionListQuery, previewScenario?: unknown): Promise<PromotionListResult>
  /** Null when the coupon doesn't exist for this restaurant. */
  get(promotionId: string, previewScenario?: unknown): Promise<Promotion | null>
}
