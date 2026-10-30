import { CUSTOMER_SORTS, DEFAULT_CUSTOMER_SORT, type CustomerListQuery, type CustomerOrdersQuery, type CustomerSort } from "./types"

export const CUSTOMERS_PAGE_SIZE = 10
export const CUSTOMER_ORDERS_PAGE_SIZE = 10
export const CUSTOMER_SEARCH_MAX_LENGTH = 60
export const CUSTOMERS_PATH = "/customers"

export type RawSearchParams = Record<string, string | string[] | undefined>

const PAGE_PATTERN = /^[1-9]\d{0,5}$/

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parsePage(value: string | undefined) {
  return value !== undefined && PAGE_PATTERN.test(value) ? Number(value) : 1
}

function isSort(value: string): value is CustomerSort {
  return (CUSTOMER_SORTS as readonly string[]).includes(value)
}

/**
 * Turns untrusted URL search params into a valid, bounded list query (C8).
 * Anything that isn't exactly a supported value falls back to the default,
 * like the Reviews and Orders lists.
 */
export function parseCustomerListQuery(params: RawSearchParams): CustomerListQuery {
  const sort = first(params.sort)
  return {
    search: (first(params.q) ?? "").trim().slice(0, CUSTOMER_SEARCH_MAX_LENGTH),
    sort: sort !== undefined && isSort(sort) ? sort : DEFAULT_CUSTOMER_SORT,
    page: parsePage(first(params.page)),
    pageSize: CUSTOMERS_PAGE_SIZE,
  }
}

/** The order-history page of a customer's profile, from `?orders=`. */
export function parseCustomerOrdersQuery(params: RawSearchParams): CustomerOrdersQuery {
  return { page: parsePage(first(params.orders)), pageSize: CUSTOMER_ORDERS_PAGE_SIZE }
}

type ListFields = Pick<CustomerListQuery, "search" | "sort" | "page">

function search(query: ListFields, ordersPage = 1) {
  const params = new URLSearchParams()
  if (query.search) params.set("q", query.search)
  if (query.sort !== DEFAULT_CUSTOMER_SORT) params.set("sort", query.sort)
  if (query.page > 1) params.set("page", String(query.page))
  if (ordersPage > 1) params.set("orders", String(ordersPage))
  return params.toString()
}

/** A /customers URL that keeps the current search and sort, with overrides. Defaults are left out. */
export function customersHref(query: ListFields, overrides: Partial<ListFields> = {}) {
  const queryString = search({ ...query, ...overrides })
  return queryString ? `${CUSTOMERS_PATH}?${queryString}` : CUSTOMERS_PATH
}

/** A profile URL carrying the list's search, sort and page so "back" returns to the same view. */
export function customerHref(customerId: string, query: ListFields, ordersPage = 1) {
  const queryString = search(query, ordersPage)
  const path = `${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`
  return queryString ? `${path}?${queryString}` : path
}

export function hasActiveCustomerSearch(query: Pick<CustomerListQuery, "search">) {
  return query.search.length > 0
}
