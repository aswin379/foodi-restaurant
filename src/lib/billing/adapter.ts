import type { RestaurantContext } from "@/lib/restaurant/context"

import type { Plan } from "./types"

/**
 * What the Billing screen needs from a data source. Read-only: B6d has no plan
 * change, payment or cancellation action. Two implementations: the Foodi API
 * (api-source.ts) and labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type BillingAdapter = {
  context(): Promise<RestaurantContext>
  /** Null when there is no plan for this restaurant (the proposed API answers 404). */
  plan(previewScenario?: unknown): Promise<Plan | null>
}
