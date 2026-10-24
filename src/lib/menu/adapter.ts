import type { RestaurantContext } from "@/lib/restaurant/context"

import type { MenuCommand } from "./commands"
import type { MenuCommandResult } from "./rules"
import type { MenuCategory, MenuItem, MenuItemListQuery, MenuItemListResult } from "./types"

/**
 * What the Menu screens need from a data source: the Foodi API
 * (api-source.ts) or labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type MenuAdapter = {
  context(): Promise<RestaurantContext>
  listItems(query: MenuItemListQuery, previewScenario?: unknown): Promise<MenuItemListResult>
  /** Null when the item doesn't exist for this restaurant. */
  getItem(itemId: string, previewScenario?: unknown): Promise<MenuItem | null>
  /** Every category, archived ones included, in display order. */
  listCategories(previewScenario?: unknown): Promise<MenuCategory[]>
  /** Applies a restaurant command. Replays the stored result for a repeated key. */
  act(command: MenuCommand, idempotencyKey: string): Promise<MenuCommandResult>
}
