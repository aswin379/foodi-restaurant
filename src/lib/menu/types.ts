import type { OrderType } from "@/lib/domain/order-types"
import type { Money } from "@/lib/orders/types"

import type { ItemSchedule } from "./schedule"

// Menu model from PRD v0.3 §5 (with D7 and Q11). It's the frontend's working
// model, not a confirmed backend contract.

export type { Money }

export const DIETARY_TYPES = ["veg", "non_veg", "egg", "vegan"] as const
export type DietaryType = (typeof DIETARY_TYPES)[number]

export const SPICE_LEVELS = ["none", "mild", "medium", "hot"] as const
export type SpiceLevel = (typeof SPICE_LEVELS)[number]

export const ITEM_TAGS = ["bestseller", "new", "chefs_special"] as const
export type ItemTag = (typeof ITEM_TAGS)[number]

/** PROVISIONAL allergen list; the PRD names allergens but not the list. */
export const ALLERGENS = [
  "gluten",
  "dairy",
  "egg",
  "nuts",
  "peanuts",
  "soy",
  "sesame",
  "mustard",
  "fish",
  "shellfish",
] as const
export type Allergen = (typeof ALLERGENS)[number]

/** Which order types an item or category is offered for (PRD §3.4 Channels). */
export type ChannelSettings = Record<OrderType, boolean>

/** A size the customer picks exactly one of; its price replaces the base price. */
export type MenuSize = {
  id: string
  name: string
  price: Money
  available: boolean
}

/** An option within a group; its price is added (0 = free). */
export type MenuOption = {
  id: string
  name: string
  price: Money
  available: boolean
}

export type OptionGroup = {
  id: string
  name: string
  selection: "single" | "multiple"
  required: boolean
  /** Selections allowed. For single choice: min 0 or 1, max 1. */
  min: number
  max: number
  options: MenuOption[]
}

/**
 * How long an item stays sold out (PRD §3.2 SoldOutState). "next_opening" and
 * "end_of_day" resolve against restaurant hours, which arrive in B3; "at" is
 * an instant computed by the server.
 */
export type SoldOutUntil = "next_opening" | "end_of_day" | "manual" | { at: string }

export type SoldOutState = {
  until: SoldOutUntil
  reason: string | null
  since: string
  by: string
}

export type MenuItem = {
  id: string
  name: string
  description: string | null
  /** Required for active items (D7); archived items keep their last category. */
  categoryId: string
  categoryName: string
  /** Base price, used when the item has no sizes. */
  price: Money
  sizes: MenuSize[]
  optionGroups: OptionGroup[]
  imageUrl: string | null
  dietary: DietaryType
  allergens: Allergen[]
  spiceLevel: SpiceLevel
  tags: ItemTag[]
  /** Optional nutrition: energy per serving. */
  calories: number | null
  soldOut: SoldOutState | null
  channels: ChannelSettings
  /** When the item can be ordered (PRD §3.4). Only narrows availability. */
  schedule: ItemSchedule
  archived: boolean
  /** Set by the server; items that have been ordered are archived, not deleted. */
  usedOnOrders: boolean
}

export type MenuCategory = {
  id: string
  name: string
  description: string | null
  /** Display order, ascending. */
  position: number
  /** Category switched on or off (PRD §3.4). */
  active: boolean
  channels: ChannelSettings
  archived: boolean
  usedOnOrders: boolean
  /** Active (not archived) items in this category. */
  itemCount: number
}

export const MENU_LIST_FILTERS = ["all", "available", "sold_out", "archived"] as const
export type MenuListFilter = (typeof MENU_LIST_FILTERS)[number]

export type MenuItemListQuery = {
  /** "all" means every active item; archived items only appear under "archived". */
  filter: MenuListFilter
  search: string
  categoryId: string | null
  page: number
  pageSize: number
}

export type MenuItemListResult = {
  items: MenuItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
