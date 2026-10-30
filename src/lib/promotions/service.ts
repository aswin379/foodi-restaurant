import "server-only"

import { connection } from "next/server"

import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { PromotionsAdapter } from "./adapter"
import { apiPromotionsAdapter } from "./api-source"
import { createPreviewPromotionsAdapter } from "./preview-source"
import type { Promotion, PromotionListQuery, PromotionListResult } from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_PROMOTIONS_DATA_SOURCE=preview) and is refused in production builds:
 * there it resolves to the API whatever the variable says. There is no
 * fallback: if the API fails, the UI shows an error.
 */
function promotions(): { mode: DataSourceMode; adapter: PromotionsAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_PROMOTIONS_DATA_SOURCE,
    api: apiPromotionsAdapter,
    preview: createPreviewPromotionsAdapter,
  })
}

export function promotionsMode(): DataSourceMode {
  return promotions().mode
}

export async function getPromotionsContext(): Promise<RestaurantContext> {
  await connection()
  return promotions().adapter.context()
}

export async function listPromotions(query: PromotionListQuery, previewScenario?: unknown): Promise<PromotionListResult> {
  await connection()
  return promotions().adapter.list(query, previewScenario)
}

/** Returns null when the coupon isn't in this restaurant's scope. */
export async function getPromotion(promotionId: string, previewScenario?: unknown): Promise<Promotion | null> {
  await connection()
  return promotions().adapter.get(promotionId, previewScenario)
}
