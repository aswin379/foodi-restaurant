import "server-only"

import { connection } from "next/server"

import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { WalletAdapter } from "./adapter"
import { apiWalletAdapter } from "./api-source"
import { createPreviewWalletAdapter } from "./preview-source"
import type {
  SettlementDetail,
  SettlementListQuery,
  SettlementListResult,
  SettlementOrdersQuery,
  SettlementOrdersResult,
  WalletSummary,
} from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_WALLET_DATA_SOURCE=preview) and is refused in production builds:
 * there it resolves to the API whatever the variable says. There is no
 * fallback: if the API fails, the UI shows an error.
 */
function wallet(): { mode: DataSourceMode; adapter: WalletAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_WALLET_DATA_SOURCE,
    api: apiWalletAdapter,
    preview: createPreviewWalletAdapter,
  })
}

export function walletMode(): DataSourceMode {
  return wallet().mode
}

export async function getWalletContext(): Promise<RestaurantContext> {
  await connection()
  return wallet().adapter.context()
}

export async function getWalletSummary(previewScenario?: unknown): Promise<WalletSummary> {
  await connection()
  return wallet().adapter.summary(previewScenario)
}

export async function listSettlements(query: SettlementListQuery, previewScenario?: unknown): Promise<SettlementListResult> {
  await connection()
  return wallet().adapter.settlements(query, previewScenario)
}

/** Returns null when the settlement isn't in this restaurant's scope. */
export async function getSettlement(settlementId: string, previewScenario?: unknown): Promise<SettlementDetail | null> {
  await connection()
  return wallet().adapter.settlement(settlementId, previewScenario)
}

/** Returns null when the settlement isn't in this restaurant's scope. */
export async function listSettlementOrders(
  settlementId: string,
  query: SettlementOrdersQuery,
  previewScenario?: unknown
): Promise<SettlementOrdersResult | null> {
  await connection()
  return wallet().adapter.settlementOrders(settlementId, query, previewScenario)
}
