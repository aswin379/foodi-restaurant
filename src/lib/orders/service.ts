import "server-only"

import { connection } from "next/server"

import { ServiceError } from "@/lib/data-source/errors"
import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { OrdersAdapter } from "./adapter"
import { apiOrdersAdapter } from "./api-source"
import type { OrderCommand } from "./commands"
import {
  createPreviewOrdersAdapter,
  resetPreviewOrders,
  simulateIncomingPreviewOrder,
} from "./preview-source"
import type { OrderDetail, OrderListQuery, OrderListResult, Rider } from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_ORDERS_DATA_SOURCE=preview, or the older value "fixtures") and is
 * refused in production builds. There is no fallback: if the API fails, the
 * UI shows an error.
 */
function orders(): { mode: DataSourceMode; adapter: OrdersAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_ORDERS_DATA_SOURCE,
    api: apiOrdersAdapter,
    preview: createPreviewOrdersAdapter,
  })
}

export function ordersMode(): DataSourceMode {
  return orders().mode
}

export async function getOrdersContext(): Promise<RestaurantContext> {
  await connection()
  return orders().adapter.context()
}

export async function listOrders(
  query: OrderListQuery,
  previewScenario?: unknown
): Promise<OrderListResult> {
  await connection()
  return orders().adapter.list(query, previewScenario)
}

export async function getOrderBoard(previewScenario?: unknown): Promise<OrderDetail[]> {
  await connection()
  return orders().adapter.board(previewScenario)
}

/** Returns null when the order doesn't exist for this restaurant. */
export async function getOrder(orderId: string, previewScenario?: unknown): Promise<OrderDetail | null> {
  await connection()
  return orders().adapter.get(orderId, previewScenario)
}

export async function listRiders(): Promise<Rider[]> {
  await connection()
  return orders().adapter.riders()
}

export async function performOrderCommand(
  orderId: string,
  command: OrderCommand,
  idempotencyKey: string
): Promise<OrderDetail> {
  return orders().adapter.act(orderId, command, idempotencyKey)
}

function assertPreviewMode() {
  if (orders().mode !== "preview") {
    throw new ServiceError("forbidden", "Preview controls are only available in preview mode.")
  }
}

export async function simulateIncomingOrder(): Promise<OrderDetail> {
  assertPreviewMode()
  return simulateIncomingPreviewOrder()
}

export async function resetOrdersPreview(): Promise<void> {
  assertPreviewMode()
  resetPreviewOrders()
}
