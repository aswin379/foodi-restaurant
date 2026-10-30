import { PROMOTION_STATUS_FILTERS, type PromotionListQuery, type PromotionStatusFilter } from "./types"

export const PROMOTIONS_PAGE_SIZE = 10
export const PROMOTIONS_PATH = "/promotions"

export type RawSearchParams = Record<string, string | string[] | undefined>

const PAGE_PATTERN = /^[1-9]\d{0,5}$/

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isStatusFilter(value: string): value is PromotionStatusFilter {
  return (PROMOTION_STATUS_FILTERS as readonly string[]).includes(value)
}

/**
 * Turns untrusted URL search params into a valid, bounded list query. Anything
 * that isn't exactly a supported value falls back to the default, like the
 * Reviews, Customers and Wallet lists.
 */
export function parsePromotionListQuery(params: RawSearchParams): PromotionListQuery {
  const status = first(params.status)
  const page = first(params.page)
  return {
    status: status !== undefined && isStatusFilter(status) ? status : "all",
    page: page !== undefined && PAGE_PATTERN.test(page) ? Number(page) : 1,
    pageSize: PROMOTIONS_PAGE_SIZE,
  }
}

type FilterFields = Pick<PromotionListQuery, "status" | "page">

function search(query: FilterFields) {
  const params = new URLSearchParams()
  if (query.status !== "all") params.set("status", query.status)
  if (query.page > 1) params.set("page", String(query.page))
  return params.toString()
}

/** A /promotions URL that keeps the current filter, with overrides. Defaults are left out. */
export function promotionsHref(query: FilterFields, overrides: Partial<FilterFields> = {}) {
  const queryString = search({ ...query, ...overrides })
  return queryString ? `${PROMOTIONS_PATH}?${queryString}` : PROMOTIONS_PATH
}

/** A coupon's detail URL, carrying the list's filter and page so "back" returns to the same view. */
export function promotionHref(promotionId: string, query: FilterFields) {
  const queryString = search(query)
  const path = `${PROMOTIONS_PATH}/${encodeURIComponent(promotionId)}`
  return queryString ? `${path}?${queryString}` : path
}

export function hasActivePromotionFilter(query: Pick<PromotionListQuery, "status">) {
  return query.status !== "all"
}
