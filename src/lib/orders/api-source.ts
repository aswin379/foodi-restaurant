import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { OrdersAdapter } from "./adapter"
import { daySummaryFromApi } from "./api-mapping"
import type { OrderDetail, OrderListResult, Rider } from "./types"

/**
 * Integration point for the Foodi orders API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Orders aren't connected yet". The paths
 * below are the PROPOSED contract in docs/orders-ui.md, not confirmed
 * endpoints. When the contract is fixed, map responses through
 * src/lib/api/mapping.ts here. Never fall back to preview data.
 */
const PROPOSED_PATHS = {
  orders: "/seller/orders",
  board: "/seller/orders/board",
  order: (id: string) => `/seller/orders/${encodeURIComponent(id)}`,
  commands: (id: string) => `/seller/orders/${encodeURIComponent(id)}/commands`,
  riders: "/seller/riders",
  /** B5a, PROPOSED (docs/dashboard-ui.md): `?date=YYYY-MM-DD`, restaurant-local. */
  summary: "/seller/orders/summary",
}

export const apiOrdersAdapter: OrdersAdapter = {
  context: getRestaurantContext,

  list(query) {
    return getApiTransport().request<OrderListResult>({
      method: "GET",
      path: PROPOSED_PATHS.orders,
      query: {
        status: query.status === "all" ? undefined : query.status,
        q: query.search || undefined,
        from: query.from ?? undefined,
        to: query.to ?? undefined,
        page: query.page,
        pageSize: query.pageSize,
      },
    })
  },

  board() {
    return getApiTransport().request<OrderDetail[]>({ method: "GET", path: PROPOSED_PATHS.board })
  },

  get(orderId) {
    return getApiTransport().request<OrderDetail | null>({
      method: "GET",
      path: PROPOSED_PATHS.order(orderId),
    })
  },

  async daySummary(date) {
    // The restaurant's zone comes from the session context, so the summary can be checked against it.
    const [context, response] = await Promise.all([
      getRestaurantContext(),
      getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.summary, query: { date } }),
    ])
    return daySummaryFromApi(response, { date, timeZone: context.timeZone })
  },

  riders() {
    return getApiTransport().request<Rider[]>({ method: "GET", path: PROPOSED_PATHS.riders })
  },

  act(orderId, command, idempotencyKey) {
    return getApiTransport().request<OrderDetail>({
      method: "POST",
      path: PROPOSED_PATHS.commands(orderId),
      body: command,
      idempotencyKey,
    })
  },
}
