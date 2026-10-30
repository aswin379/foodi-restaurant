import {
  isReviewRating,
  REVIEW_REPLIED_FILTERS,
  type ReviewListQuery,
  type ReviewRepliedFilter,
} from "./types"

export const REVIEWS_PAGE_SIZE = 10
export const REVIEWS_PATH = "/reviews"

export type RawSearchParams = Record<string, string | string[] | undefined>

const PAGE_PATTERN = /^[1-9]\d{0,5}$/

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isRepliedFilter(value: string): value is ReviewRepliedFilter {
  return (REVIEW_REPLIED_FILTERS as readonly string[]).includes(value)
}

/**
 * Turns untrusted URL search params into a valid, bounded list query. Anything
 * that isn't exactly a supported value ("3.5", "03", "5abc", "0", "-1") falls
 * back to the default, like the Orders and Menu lists.
 */
export function parseReviewListQuery(params: RawSearchParams): ReviewListQuery {
  const rating = first(params.rating)
  const replied = first(params.replied)
  const page = first(params.page)
  const ratingNumber = rating !== undefined && /^[1-5]$/.test(rating) ? Number(rating) : null

  return {
    rating: isReviewRating(ratingNumber) ? ratingNumber : "all",
    replied: replied !== undefined && isRepliedFilter(replied) ? replied : "all",
    page: page !== undefined && PAGE_PATTERN.test(page) ? Number(page) : 1,
    pageSize: REVIEWS_PAGE_SIZE,
  }
}

type FilterFields = Pick<ReviewListQuery, "rating" | "replied" | "page">

function search(query: FilterFields) {
  const params = new URLSearchParams()
  if (query.rating !== "all") params.set("rating", String(query.rating))
  if (query.replied !== "all") params.set("replied", query.replied)
  if (query.page > 1) params.set("page", String(query.page))
  return params.toString()
}

/** A /reviews URL that keeps the current filters, with overrides. Defaults are left out. */
export function reviewsHref(query: FilterFields, overrides: Partial<FilterFields> = {}) {
  const queryString = search({ ...query, ...overrides })
  return queryString ? `${REVIEWS_PATH}?${queryString}` : REVIEWS_PATH
}

/** A review's detail URL, carrying the list's filters so "back" returns to the same view. */
export function reviewHref(reviewId: string, query: FilterFields) {
  const queryString = search(query)
  const path = `${REVIEWS_PATH}/${encodeURIComponent(reviewId)}`
  return queryString ? `${path}?${queryString}` : path
}

export function hasActiveReviewFilters(query: Pick<ReviewListQuery, "rating" | "replied">) {
  return query.rating !== "all" || query.replied !== "all"
}
