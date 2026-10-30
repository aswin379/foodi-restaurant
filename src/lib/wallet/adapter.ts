import type { RestaurantContext } from "@/lib/restaurant/context"

import type {
  SettlementDetail,
  SettlementListQuery,
  SettlementListResult,
  SettlementOrdersQuery,
  SettlementOrdersResult,
  WalletSummary,
} from "./types"

/**
 * What the Wallet screens need from a data source. Read-only: B6c has no
 * withdrawal, payout or edit actions. Two implementations: the Foodi API
 * (api-source.ts) and labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type WalletAdapter = {
  context(): Promise<RestaurantContext>
  summary(previewScenario?: unknown): Promise<WalletSummary>
  settlements(query: SettlementListQuery, previewScenario?: unknown): Promise<SettlementListResult>
  /** Null when the settlement doesn't exist for this restaurant. */
  settlement(settlementId: string, previewScenario?: unknown): Promise<SettlementDetail | null>
  /** Null when the settlement doesn't exist for this restaurant. */
  settlementOrders(
    settlementId: string,
    query: SettlementOrdersQuery,
    previewScenario?: unknown
  ): Promise<SettlementOrdersResult | null>
}
