import "server-only"

import { MenuServiceError } from "./errors"
import type { MenuCategory, MenuItem, MenuItemListQuery, MenuItemListResult } from "./types"

/**
 * Integration point for the Foodi menu API.
 *
 * No menu API exists yet, so every function reports `not_configured`. When the
 * contract is approved, implement these server-side with the restaurant
 * session, map responses to ./types, and throw MenuServiceError("unavailable")
 * on failure. Never fall back to fixtures. Proposed contract: docs/menu-ui.md.
 */
export async function fetchMenuItems(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _query: MenuItemListQuery
): Promise<MenuItemListResult> {
  throw new MenuServiceError("not_configured")
}

export async function fetchMenuItem(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _itemId: string
): Promise<MenuItem | null> {
  throw new MenuServiceError("not_configured")
}

export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  throw new MenuServiceError("not_configured")
}
