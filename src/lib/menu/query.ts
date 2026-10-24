import { MENU_AVAILABILITY, type MenuAvailability, type MenuItemListQuery } from "./types"

export const MENU_PAGE_SIZE = 10
const MAX_SEARCH_LENGTH = 80
const ID_PATTERN = /^[\w-]{1,64}$/

export type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isAvailability(value: string): value is MenuAvailability {
  return (MENU_AVAILABILITY as readonly string[]).includes(value)
}

/** Turns untrusted URL search params into a valid, bounded list query. */
export function parseMenuItemListQuery(params: RawSearchParams): MenuItemListQuery {
  const availability = first(params.availability) ?? "all"
  const category = first(params.category)
  const page = Number.parseInt(first(params.page) ?? "1", 10)

  return {
    availability: isAvailability(availability) ? availability : "all",
    search: (first(params.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    categoryId: category && ID_PATTERN.test(category) ? category : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: MENU_PAGE_SIZE,
  }
}

/** Builds a /menu URL that keeps the current filters, with overrides. */
export function menuHref(
  query: MenuItemListQuery,
  overrides: Partial<Pick<MenuItemListQuery, "availability" | "page">> = {}
) {
  const next = { ...query, ...overrides }
  const params = new URLSearchParams()
  if (next.availability !== "all") params.set("availability", next.availability)
  if (next.search) params.set("q", next.search)
  if (next.categoryId) params.set("category", next.categoryId)
  if (next.page > 1) params.set("page", String(next.page))
  const search = params.toString()
  return search ? `/menu?${search}` : "/menu"
}

export function hasActiveMenuFilters(query: MenuItemListQuery) {
  return Boolean(query.search || query.categoryId)
}
