import "server-only"

import { OrdersServiceError } from "./errors"
import type { OrderDetail, OrderListQuery, OrderListResult } from "./types"

/**
 * Integration point for the Foodi orders API.
 *
 * No orders API exists yet, so these functions always report
 * `not_configured`. When the backend contract is approved, implement them
 * here: call the API server-side with the restaurant session, map responses
 * to the types in ./types, and throw OrdersServiceError("unavailable") on
 * failure. Never fall back to fixtures. The proposed contract is in
 * docs/orders-ui.md.
 */
export async function fetchOrderList(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _query: OrderListQuery
): Promise<OrderListResult> {
  throw new OrdersServiceError("not_configured")
}

export async function fetchOrder(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orderId: string
): Promise<OrderDetail | null> {
  throw new OrdersServiceError("not_configured")
}
