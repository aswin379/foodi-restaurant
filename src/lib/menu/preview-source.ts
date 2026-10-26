import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { MenuAdapter } from "./adapter"
import { buildFixtureMenu } from "./fixtures/menu"
import { applyMenuCommand, itemStatus, withItemCount, withUsage, type MenuCommandResult, type MenuState } from "./rules"
import type { MenuItemListQuery, MenuItemListResult } from "./types"

// PREVIEW ADAPTER (development only). The whole menu lives as one record in
// the in-memory preview store, so each command is applied atomically. Nothing
// reaches Foodi, everything resets when the server restarts, and the store
// refuses to run in production.

/** `?preview=empty|error|slow` shows those states without a backend. */
export function parsePreviewScenario(value: unknown) {
  return value === "empty" || value === "error" || value === "slow" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 100)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  return scenario
}

type StoredMenu = MenuState & { id: "menu" }
const MENU_ID = "menu"

const menu = () =>
  getPreviewCollection<StoredMenu>("menu", () => [{ id: MENU_ID, ...buildFixtureMenu(Date.now()) }])
// Results of commands already applied, by idempotency key.
const processed = () =>
  getPreviewCollection<{ id: string; command: string; result: MenuCommandResult }>("menu.idempotency", () => [])

function current(): StoredMenu {
  const state = menu().get(MENU_ID)
  if (!state) throw new ServiceError("unavailable", "Preview menu is missing.")
  return state
}

let sequence = 0
const newId = (kind: string) => `prv-${kind}-new-${Date.now().toString(36)}-${(sequence++).toString(36)}`

export function createPreviewMenuAdapter(): MenuAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async listItems(query: MenuItemListQuery, previewScenario?: unknown): Promise<MenuItemListResult> {
      const scenario = await applyScenario(previewScenario)
      const state = current()
      const categories = new Map(state.categories.map((category) => [category.id, category]))
      const order = (categoryId: string) => categories.get(categoryId)?.position ?? Number.MAX_SAFE_INTEGER
      const search = query.search.toLowerCase()

      const matching = (scenario === "empty" ? [] : state.items)
        .filter((item) => {
          const status = itemStatus(item, categories.get(item.categoryId) ?? null)
          if (query.filter === "archived" ? status.kind !== "archived" : status.kind === "archived") return false
          if (query.filter === "available" && status.kind !== "available") return false
          if (query.filter === "sold_out" && status.kind !== "sold_out") return false
          if (query.categoryId && item.categoryId !== query.categoryId) return false
          if (search && !item.name.toLowerCase().includes(search)) return false
          return true
        })
        .sort((a, b) => order(a.categoryId) - order(b.categoryId) || a.name.localeCompare(b.name))

      const totalPages = Math.max(1, Math.ceil(matching.length / query.pageSize))
      const page = Math.min(query.page, totalPages)
      const start = (page - 1) * query.pageSize
      return {
        items: matching.slice(start, start + query.pageSize),
        page,
        pageSize: query.pageSize,
        totalItems: matching.length,
        totalPages,
      }
    },

    async getItem(itemId, previewScenario?: unknown) {
      await applyScenario(previewScenario)
      return current().items.find((item) => item.id === itemId) ?? null
    },

    async listCategories(previewScenario?: unknown) {
      const scenario = await applyScenario(previewScenario)
      if (scenario === "empty") return []
      const state = current()
      return state.categories
        .map((category) => withItemCount(category, state.items))
        .sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position)
    },

    async listMealPeriods(previewScenario?: unknown) {
      const scenario = await applyScenario(previewScenario)
      if (scenario === "empty") return []
      const state = current()
      return state.mealPeriods
        .map((period) => withUsage(period, state))
        .sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived") || a.name.localeCompare(b.name))
    },

    async act(command, idempotencyKey) {
      await delay(200)
      const fingerprint = JSON.stringify(command)
      const replay = processed().get(idempotencyKey)
      if (replay) {
        if (replay.command !== fingerprint) {
          throw new ServiceError("conflict", "This request key was already used for a different change.")
        }
        return replay.result
      }
      let result: MenuCommandResult | undefined
      menu().update(MENU_ID, (state) => {
        const applied = applyMenuCommand(state, command, {
          now: new Date(),
          actor: "Preview staff",
          timeZone: PREVIEW_RESTAURANT.timeZone,
          newId,
        })
        result = applied.result
        return { ...applied.state, id: MENU_ID }
      })
      processed().insert({ id: idempotencyKey, command: fingerprint, result: result! })
      return result!
    },
  }
}

/** Preview control: restores the starting sample menu. */
export function resetPreviewMenu() {
  menu().reset()
  processed().reset()
}
