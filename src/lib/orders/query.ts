import { ORDER_STATUSES, type OrderListQuery, type OrderStatus } from "./types"

export const ORDERS_PAGE_SIZE = 10
const MAX_SEARCH_LENGTH = 60
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

function parseDate(value: string | undefined) {
  if (!value || !DATE_PATTERN.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : value
}

/** Turns untrusted URL search params into a valid, bounded list query. */
export function parseOrderListQuery(params: RawSearchParams): OrderListQuery {
  const status = first(params.status) ?? "all"
  const page = Number.parseInt(first(params.page) ?? "1", 10)
  let from = parseDate(first(params.from))
  let to = parseDate(first(params.to))
  if (from && to && from > to) [from, to] = [to, from]

  return {
    status: isOrderStatus(status) ? status : "all",
    search: (first(params.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    from,
    to,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: ORDERS_PAGE_SIZE,
  }
}

export const ORDER_HISTORY_PATH = "/orders/history"

/** Builds an order-history URL that keeps the current filters, with overrides. */
export function ordersHref(
  query: OrderListQuery,
  overrides: Partial<Pick<OrderListQuery, "status" | "page">> = {}
) {
  const next = { ...query, ...overrides }
  const params = new URLSearchParams()
  if (next.status !== "all") params.set("status", next.status)
  if (next.search) params.set("q", next.search)
  if (next.from) params.set("from", next.from)
  if (next.to) params.set("to", next.to)
  if (next.page > 1) params.set("page", String(next.page))
  const search = params.toString()
  return search ? `${ORDER_HISTORY_PATH}?${search}` : ORDER_HISTORY_PATH
}

export function hasActiveFilters(query: OrderListQuery) {
  return Boolean(query.search || query.from || query.to)
}
