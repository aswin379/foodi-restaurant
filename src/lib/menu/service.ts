import "server-only"

import { connection } from "next/server"

import { fetchMenuCategories, fetchMenuItem, fetchMenuItems } from "./api-source"
import {
  getFixtureMenuItem,
  listFixtureMenuCategories,
  listFixtureMenuItems,
  parsePreviewScenario,
} from "./fixtures/source"
import type { MenuCategory, MenuItem, MenuItemListQuery, MenuItemListResult } from "./types"

export type MenuDataSource = "api" | "fixtures"

/**
 * Fixtures are an explicit development opt-in (FOODI_MENU_DATA_SOURCE=fixtures)
 * and are refused in production builds. There is no automatic fallback: if
 * the API fails, the UI shows an error.
 */
export function menuDataSource(): MenuDataSource {
  return process.env.FOODI_MENU_DATA_SOURCE === "fixtures" &&
    process.env.NODE_ENV !== "production"
    ? "fixtures"
    : "api"
}

export async function listMenuItems(
  query: MenuItemListQuery,
  previewParam?: unknown
): Promise<MenuItemListResult> {
  await connection()
  return menuDataSource() === "fixtures"
    ? listFixtureMenuItems(query, parsePreviewScenario(previewParam))
    : fetchMenuItems(query)
}

/** Returns null when the item doesn't exist for this restaurant. */
export async function getMenuItem(
  itemId: string,
  previewParam?: unknown
): Promise<MenuItem | null> {
  await connection()
  return menuDataSource() === "fixtures"
    ? getFixtureMenuItem(itemId, parsePreviewScenario(previewParam))
    : fetchMenuItem(itemId)
}

export async function listMenuCategories(previewParam?: unknown): Promise<MenuCategory[]> {
  await connection()
  return menuDataSource() === "fixtures"
    ? listFixtureMenuCategories(parsePreviewScenario(previewParam))
    : fetchMenuCategories()
}
