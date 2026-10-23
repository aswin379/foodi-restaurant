import "server-only"

import { connection } from "next/server"

import { ServiceError } from "@/lib/data-source/errors"
import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { MenuAdapter } from "./adapter"
import { apiMenuAdapter } from "./api-source"
import type { MenuCommand } from "./commands"
import { createPreviewMenuAdapter, resetPreviewMenu } from "./preview-source"
import type { MenuCommandResult } from "./rules"
import type { MenuCategory, MenuItem, MenuItemListQuery, MenuItemListResult } from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_MENU_DATA_SOURCE=preview, or the older value "fixtures") and is
 * refused in production builds. There is no fallback: if the API fails, the
 * UI shows an error.
 */
function menu(): { mode: DataSourceMode; adapter: MenuAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_MENU_DATA_SOURCE,
    api: apiMenuAdapter,
    preview: createPreviewMenuAdapter,
  })
}

export function menuMode(): DataSourceMode {
  return menu().mode
}

export async function getMenuContext(): Promise<RestaurantContext> {
  await connection()
  return menu().adapter.context()
}

export async function listMenuItems(query: MenuItemListQuery, previewScenario?: unknown): Promise<MenuItemListResult> {
  await connection()
  return menu().adapter.listItems(query, previewScenario)
}

/** Returns null when the item doesn't exist for this restaurant. */
export async function getMenuItem(itemId: string, previewScenario?: unknown): Promise<MenuItem | null> {
  await connection()
  return menu().adapter.getItem(itemId, previewScenario)
}

export async function listMenuCategories(previewScenario?: unknown): Promise<MenuCategory[]> {
  await connection()
  return menu().adapter.listCategories(previewScenario)
}

export async function performMenuCommand(command: MenuCommand, idempotencyKey: string): Promise<MenuCommandResult> {
  return menu().adapter.act(command, idempotencyKey)
}

export async function resetMenuPreview(): Promise<void> {
  if (menu().mode !== "preview") {
    throw new ServiceError("forbidden", "Preview controls are only available in preview mode.")
  }
  resetPreviewMenu()
}
