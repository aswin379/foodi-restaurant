import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { isServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { CustomersAdapter } from "./adapter"
import { customerDetailFromApi, customerListFromApi, customerOrdersFromApi } from "./api-mapping"

/**
 * Integration point for the Foodi customers API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Customers aren't connected yet". Every path
 * and payload here is the PROPOSED contract in docs/customers-ui.md, not
 * agreed with the backend team. Never fall back to preview data. The
 * restaurant comes from the seller session on the server; no restaurant ID is
 * ever taken from the URL or sent by the page (C7).
 */
const PROPOSED_PATHS = {
  customers: "/seller/customers",
  customer: (id: string) => `/seller/customers/${encodeURIComponent(id)}`,
  orders: (id: string) => `/seller/customers/${encodeURIComponent(id)}/orders`,
}

export const apiCustomersAdapter: CustomersAdapter = {
  context: getRestaurantContext,

  async list(query) {
    const { currency } = await getRestaurantContext()
    return customerListFromApi(
      await getApiTransport().request<unknown>({
        method: "GET",
        path: PROPOSED_PATHS.customers,
        query: {
          q: query.search || undefined,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        },
      }),
      { currency }
    )
  },

  async get(customerId) {
    const { currency } = await getRestaurantContext()
    try {
      return customerDetailFromApi(
        await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.customer(customerId) }),
        { currency }
      )
    } catch (error) {
      if (isServiceError(error) && error.kind === "not_found") return null
      throw error
    }
  },

  async orders(customerId, query) {
    const { currency } = await getRestaurantContext()
    try {
      return customerOrdersFromApi(
        await getApiTransport().request<unknown>({
          method: "GET",
          path: PROPOSED_PATHS.orders(customerId),
          query: { page: query.page, pageSize: query.pageSize },
        }),
        { currency }
      )
    } catch (error) {
      if (isServiceError(error) && error.kind === "not_found") return null
      throw error
    }
  },
}
