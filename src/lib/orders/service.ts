import "server-only"

import { connection } from "next/server"

import { fetchOrder, fetchOrderList } from "./api-source"
import {
  getFixtureOrder,
  listFixtureOrders,
  parsePreviewScenario,
} from "./fixtures/source"
import type { OrderDetail, OrderListQuery, OrderListResult } from "./types"

export type OrdersDataSource = "api" | "fixtures"

/**
 * Fixtures are an explicit development opt-in
 * (FOODI_ORDERS_DATA_SOURCE=fixtures) and are refused in production builds.
 * There is no automatic fallback: if the API fails, the UI shows an error.
 */
export function ordersDataSource(): OrdersDataSource {
  return process.env.FOODI_ORDERS_DATA_SOURCE === "fixtures" &&
    process.env.NODE_ENV !== "production"
    ? "fixtures"
    : "api"
}

export async function listOrders(
  query: OrderListQuery,
  previewParam?: unknown
): Promise<OrderListResult> {
  await connection()
  return ordersDataSource() === "fixtures"
    ? listFixtureOrders(query, parsePreviewScenario(previewParam))
    : fetchOrderList(query)
}

/** Returns null when the order doesn't exist for this restaurant. */
export async function getOrder(
  orderId: string,
  previewParam?: unknown
): Promise<OrderDetail | null> {
  await connection()
  return ordersDataSource() === "fixtures"
    ? getFixtureOrder(orderId, parsePreviewScenario(previewParam))
    : fetchOrder(orderId)
}
