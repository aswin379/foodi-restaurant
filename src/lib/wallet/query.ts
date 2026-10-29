import type { SettlementListQuery, SettlementOrdersQuery } from "./types"

export const SETTLEMENTS_PAGE_SIZE = 10
export const SETTLEMENT_ORDERS_PAGE_SIZE = 10
/** The overview on /wallet shows only the latest few settlements. */
export const WALLET_OVERVIEW_SETTLEMENTS = 5
export const WALLET_PATH = "/wallet"
export const SETTLEMENTS_PATH = "/wallet/settlements"

export type RawSearchParams = Record<string, string | string[] | undefined>

const PAGE_PATTERN = /^[1-9]\d{0,5}$/

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parsePage(value: string | undefined) {
  return value !== undefined && PAGE_PATTERN.test(value) ? Number(value) : 1
}

/** Untrusted URL params to a bounded list query: anything but a positive whole number is page 1. */
export function parseSettlementListQuery(params: RawSearchParams): SettlementListQuery {
  return { page: parsePage(first(params.page)), pageSize: SETTLEMENTS_PAGE_SIZE }
}

/** The order-breakdown page of a settlement's detail, from `?orders=`. */
export function parseSettlementOrdersQuery(params: RawSearchParams): SettlementOrdersQuery {
  return { page: parsePage(first(params.orders)), pageSize: SETTLEMENT_ORDERS_PAGE_SIZE }
}

/** A /wallet/settlements URL. Page 1 is left out. */
export function settlementsHref(page = 1) {
  return page > 1 ? `${SETTLEMENTS_PATH}?page=${page}` : SETTLEMENTS_PATH
}

/** A settlement's URL, carrying the list page (for "back") and the breakdown page. */
export function settlementHref(settlementId: string, listPage = 1, ordersPage = 1) {
  const params = new URLSearchParams()
  if (listPage > 1) params.set("page", String(listPage))
  if (ordersPage > 1) params.set("orders", String(ordersPage))
  const queryString = params.toString()
  const path = `${SETTLEMENTS_PATH}/${encodeURIComponent(settlementId)}`
  return queryString ? `${path}?${queryString}` : path
}
