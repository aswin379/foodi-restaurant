import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { isServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { WalletAdapter } from "./adapter"
import {
  settlementDetailFromApi,
  settlementListFromApi,
  settlementOrdersFromApi,
  walletSummaryFromApi,
} from "./api-mapping"

/**
 * Integration point for the Foodi wallet and settlements API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Wallet isn't connected yet". Every path and
 * payload here is the PROPOSED contract in docs/wallet-ui.md: NOT IMPLEMENTED
 * and not agreed with the backend team. Never fall back to preview data. The
 * restaurant comes from the seller session on the server; no restaurant ID is
 * ever taken from the URL or sent by the page, and the backend must enforce
 * authorization and ownership.
 */
const PROPOSED_PATHS = {
  wallet: "/seller/wallet",
  settlements: "/seller/settlements",
  settlement: (id: string) => `/seller/settlements/${encodeURIComponent(id)}`,
  orders: (id: string) => `/seller/settlements/${encodeURIComponent(id)}/orders`,
}

export const apiWalletAdapter: WalletAdapter = {
  context: getRestaurantContext,

  async summary() {
    const { currency } = await getRestaurantContext()
    return walletSummaryFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.wallet }), {
      currency,
    })
  },

  async settlements(query) {
    const { currency } = await getRestaurantContext()
    return settlementListFromApi(
      await getApiTransport().request<unknown>({
        method: "GET",
        path: PROPOSED_PATHS.settlements,
        query: { page: query.page, pageSize: query.pageSize },
      }),
      { currency }
    )
  },

  async settlement(settlementId) {
    const { currency } = await getRestaurantContext()
    try {
      return settlementDetailFromApi(
        await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.settlement(settlementId) }),
        { currency }
      )
    } catch (error) {
      if (isServiceError(error) && error.kind === "not_found") return null
      throw error
    }
  },

  async settlementOrders(settlementId, query) {
    const { currency } = await getRestaurantContext()
    try {
      return settlementOrdersFromApi(
        await getApiTransport().request<unknown>({
          method: "GET",
          path: PROPOSED_PATHS.orders(settlementId),
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
