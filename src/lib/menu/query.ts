import { MENU_LIST_FILTERS, type MenuItemListQuery, type MenuListFilter } from "./types"

export const MENU_PAGE_SIZE = 10
const MAX_SEARCH_LENGTH = 80
const ID_PATTERN = /^[\w-]{1,64}$/

export type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isListFilter(value: string): value is MenuListFilter {
  return (MENU_LIST_FILTERS as readonly string[]).includes(value)
}

/** Turns untrusted URL search params into a valid, bounded list query. */
export function parseMenuItemListQuery(params: RawSearchParams): MenuItemListQuery {
  const filter = first(params.filter) ?? "all"
  const category = first(params.category)
  const page = Number.parseInt(first(params.page) ?? "1", 10)

  return {
    filter: isListFilter(filter) ? filter : "all",
    search: (first(params.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    categoryId: category && ID_PATTERN.test(category) ? category : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: MENU_PAGE_SIZE,
  }
}

/** Builds a /menu URL that keeps the current filters, with overrides. */
export function menuHref(
  query: MenuItemListQuery,
  overrides: Partial<Pick<MenuItemListQuery, "filter" | "page">> = {}
) {
  const next = { ...query, ...overrides }
  const params = new URLSearchParams()
  if (next.filter !== "all") params.set("filter", next.filter)
  if (next.search) params.set("q", next.search)
  if (next.categoryId) params.set("category", next.categoryId)
  if (next.page > 1) params.set("page", String(next.page))
  const search = params.toString()
  return search ? `/menu?${search}` : "/menu"
}

export function hasActiveMenuFilters(query: MenuItemListQuery) {
  return Boolean(query.search || query.categoryId)
}
