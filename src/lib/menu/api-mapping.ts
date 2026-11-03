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

/** Order types from the API, translated into Foodi's product names (G6). */
export function channelSettingsFromApi(value: unknown): ChannelSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ServiceError("unavailable", "Channel settings from API are missing or not an object.")
  }
  const record = value as Record<string, unknown>
  const settings: Partial<Record<OrderType, boolean>> = {}
  for (const [key, enabled] of Object.entries(record)) {
    if (typeof enabled !== "boolean") {
      throw new ServiceError("unavailable", `Non-boolean channel setting: ${key} = ${String(enabled)}`)
    }
    const orderType = fromApiOrderType(key)
    settings[orderType] = enabled
  }
  for (const type of ORDER_TYPES) {
    if (settings[type] === undefined) {
      throw new ServiceError("unavailable", `Missing channel setting from API: ${type}`)
    }
  }
  return settings as ChannelSettings
}

/** An item from the API: its order types first, then its schedule, which is read against them. */
export function itemFromApi(item: MenuItem): MenuItem {
  const channels = channelSettingsFromApi(item.channels)
  return { ...item, channels, schedule: scheduleFromApi(item.schedule, channels) }
}

/** A category: its order types first, then its schedule (B3b; missing = always), read against them. */
export function categoryFromApi(raw: unknown): MenuCategory {
  const cat = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>
  const channels = channelSettingsFromApi(cat.channels)
  const active =
    cat.active !== undefined
      ? Boolean(cat.active)
      : cat.isActive !== undefined
      ? Boolean(cat.isActive)
      : true
  return {
    id: String(cat.id ?? ""),
    name: String(cat.name ?? ""),
    description: (cat.description as string | null) ?? null,
    position: Number(cat.position) || 0,
    active,
    channels,
    schedule: scheduleFromApi(cat.schedule, channels),
    archived: cat.archived !== undefined ? Boolean(cat.archived) : !active,
    usedOnOrders: Boolean(cat.usedOnOrders),
    itemCount: Number(cat.itemCount ?? cat.foodCount) || 0,
  }
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
