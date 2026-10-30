import { fromApiOrderType, toApiOrderType } from "@/lib/api/mapping"
import { ServiceError } from "@/lib/data-source/errors"
import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"

import type { MenuCommand } from "./commands"
import { mealPeriodFromApi } from "./meal-periods-api"
import type { MenuCommandResult } from "./rules"
import { scheduleDraftToApi, scheduleFromApi } from "./schedule-api"
import type { ChannelSettings, MenuCategory, MenuItem, MenuItemListResult } from "./types"

// Converts menu data between the PROPOSED API shape (docs/menu-ui.md) and the
// frontend model. Order types appear as record keys (item and category
// `channels`) and as values (schedules); both go through
// src/lib/api/mapping.ts, the only place backend names may differ.

/** Item or category order types, keyed by API names. */
export function channelSettingsToApi(settings: ChannelSettings): Record<string, boolean> {
  return Object.fromEntries(ORDER_TYPES.map((type) => [toApiOrderType(type), settings[type]]))
}

/**
 * Order types from the API. Unknown or missing order types and non-boolean
 * values are integration errors, never guessed at.
 */
export function channelSettingsFromApi(value: unknown): ChannelSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ServiceError("unavailable", "Invalid order types from API: not an object")
  }
  const settings: Partial<Record<OrderType, boolean>> = {}
  for (const [key, enabled] of Object.entries(value)) {
    if (typeof enabled !== "boolean") throw new ServiceError("unavailable", `Invalid order type setting from API: ${key}`)
    settings[fromApiOrderType(key)] = enabled
  }
  const missing = ORDER_TYPES.filter((type) => settings[type] === undefined)
  if (missing.length) throw new ServiceError("unavailable", `Order types missing from API: ${missing.join(", ")}`)
  return settings as ChannelSettings
}

/** An item from the API: its order types first, then its schedule, which is read against them. */
export function itemFromApi(item: MenuItem): MenuItem {
  const channels = channelSettingsFromApi(item.channels)
  return { ...item, channels, schedule: scheduleFromApi(item.schedule, channels) }
}

/** A category: its order types first, then its schedule (B3b; missing = always), read against them. */
export function categoryFromApi(category: MenuCategory): MenuCategory {
  const channels = channelSettingsFromApi(category.channels)
  return { ...category, channels, schedule: scheduleFromApi(category.schedule, channels) }
}

export function itemListFromApi(result: MenuItemListResult): MenuItemListResult {
  return { ...result, items: result.items.map(itemFromApi) }
}

export function commandResultFromApi(result: MenuCommandResult): MenuCommandResult {
  if (result.kind === "item") return { ...result, item: itemFromApi(result.item) }
  if (result.kind === "category") return { ...result, category: categoryFromApi(result.category) }
  if (result.kind === "meal_period") return { ...result, period: mealPeriodFromApi(result.period) }
  return result
}

/** A command as sent to the API, with order types in API names. */
export function commandToApi(command: MenuCommand): unknown {
  switch (command.type) {
    case "save_item":
      return {
        ...command,
        draft: {
          ...command.draft,
          channels: channelSettingsToApi(command.draft.channels),
          schedule: scheduleDraftToApi(command.draft.schedule),
        },
      }
    case "save_category":
      return {
        ...command,
        draft: {
          ...command.draft,
          channels: channelSettingsToApi(command.draft.channels),
          ...(command.draft.schedule ? { schedule: scheduleDraftToApi(command.draft.schedule) } : {}),
        },
      }
    default:
      return command
  }
}
