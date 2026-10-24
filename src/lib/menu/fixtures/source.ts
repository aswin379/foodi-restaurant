import "server-only"

import { MenuServiceError } from "../errors"
import type { MenuCategory, MenuItem, MenuItemListQuery, MenuItemListResult } from "../types"
import { buildFixtureMenu } from "./menu"

/** Preview scenarios (`?preview=…`), only honoured in fixture mode. */
export type PreviewScenario = "empty" | "error" | "slow" | null

export function parsePreviewScenario(value: unknown): PreviewScenario {
  return value === "empty" || value === "error" || value === "slow" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(scenario: PreviewScenario) {
  await delay(scenario === "slow" ? 2500 : 150)
  if (scenario === "error") throw new MenuServiceError("unavailable", "Preview scenario: error")
}

// Mimics server-side filtering so the UI can be exercised end to end.
export async function listFixtureMenuItems(
  query: MenuItemListQuery,
  scenario: PreviewScenario
): Promise<MenuItemListResult> {
  await applyScenario(scenario)
  const all = scenario === "empty" ? [] : buildFixtureMenu().items
  const search = query.search.toLowerCase()

  const matching = all.filter((item) => {
    if (query.availability !== "all" && item.availability !== query.availability) return false
    if (query.categoryId && item.categoryId !== query.categoryId) return false
    if (search && !item.name.toLowerCase().includes(search)) return false
    return true
  })

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
}

export async function getFixtureMenuItem(
  itemId: string,
  scenario: PreviewScenario
): Promise<MenuItem | null> {
  await applyScenario(scenario)
  return buildFixtureMenu().items.find((item) => item.id === itemId) ?? null
}

export async function listFixtureMenuCategories(
  scenario: PreviewScenario
): Promise<MenuCategory[]> {
  await applyScenario(scenario)
  return scenario === "empty" ? [] : buildFixtureMenu().categories
}
