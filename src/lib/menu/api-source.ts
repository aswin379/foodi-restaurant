import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { CuisineOption, MenuAdapter } from "./adapter"
import { categoryFromApi, commandResultFromApi, commandToApi, itemFromApi, itemListFromApi } from "./api-mapping"
import { mealPeriodListFromApi } from "./meal-periods-api"
import type { MenuCommandResult } from "./rules"
import type { MenuCategory, MenuItem, MenuItemListResult } from "./types"

const PROPOSED_PATHS = {
  items: "/seller/menu/items",
  item: (id: string) => `/seller/menu/items/${encodeURIComponent(id)}`,
  categories: "/seller/menu/categories",
  mealPeriods: "/seller/menu/meal-periods",
  commands: "/seller/menu/commands",
  cuisines: "/seller/menu/cuisines",
}

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
    const res = await getApiTransport().request<MenuCategory[] | { categories: MenuCategory[] }>({
      method: "GET",
      path: PROPOSED_PATHS.categories,
    })
    const list = Array.isArray(res) ? res : Array.isArray(res?.categories) ? res.categories : []
    return list.map(categoryFromApi)
  },

  async listMealPeriods() {
    return mealPeriodListFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.mealPeriods }))
  },

  async listCuisines() {
    const res = await getApiTransport().request<CuisineOption[] | { cuisines: CuisineOption[] }>({
      method: "GET",
      path: PROPOSED_PATHS.cuisines,
    })
    return Array.isArray(res) ? res : Array.isArray(res?.cuisines) ? res.cuisines : []
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
