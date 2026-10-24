import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { MenuAdapter } from "./adapter"
import { categoryFromApi, commandResultFromApi, commandToApi, itemFromApi, itemListFromApi } from "./api-mapping"
import { mealPeriodListFromApi } from "./meal-periods-api"
import type { MenuCommandResult } from "./rules"
import type { MenuCategory, MenuItem, MenuItemListResult } from "./types"

/**
 * Integration point for the Foodi menu API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Menu isn't connected yet". The paths below
 * are the PROPOSED contract in docs/menu-ui.md, not confirmed endpoints.
 * Image upload needs its own endpoint (and server-side compression) once the
 * contract is fixed. Never fall back to preview data.
 */
const PROPOSED_PATHS = {
  items: "/seller/menu/items",
  item: (id: string) => `/seller/menu/items/${encodeURIComponent(id)}`,
  categories: "/seller/menu/categories",
  /** B3b, PROPOSED (docs/meal-periods-ui.md). Changes go through `commands`. */
  mealPeriods: "/seller/menu/meal-periods",
  commands: "/seller/menu/commands",
}

// Responses and command bodies carry order-type names, so they go through
// api-mapping.ts in both directions.
export const apiMenuAdapter: MenuAdapter = {
  context: getRestaurantContext,

  async listItems(query) {
    const result = await getApiTransport().request<MenuItemListResult>({
      method: "GET",
      path: PROPOSED_PATHS.items,
      query: {
        filter: query.filter,
        q: query.search || undefined,
        category: query.categoryId ?? undefined,
        page: query.page,
        pageSize: query.pageSize,
      },
    })
    return itemListFromApi(result)
  },

  async getItem(itemId) {
    const item = await getApiTransport().request<MenuItem | null>({ method: "GET", path: PROPOSED_PATHS.item(itemId) })
    return item && itemFromApi(item)
  },

  async listCategories() {
    const categories = await getApiTransport().request<MenuCategory[]>({ method: "GET", path: PROPOSED_PATHS.categories })
    return categories.map(categoryFromApi)
  },

  async listMealPeriods() {
    return mealPeriodListFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.mealPeriods }))
  },

  async act(command, idempotencyKey) {
    const result = await getApiTransport().request<MenuCommandResult>({
      method: "POST",
      path: PROPOSED_PATHS.commands,
      body: commandToApi(command),
      idempotencyKey,
    })
    return commandResultFromApi(result)
  },
}
