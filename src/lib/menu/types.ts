import type { Money } from "@/lib/orders/types"

// PROVISIONAL menu model (RUI-03). Working assumptions for the UI, not an
// approved backend contract. Open questions are listed in docs/menu-ui.md.

export type { Money }

export const MENU_AVAILABILITY = ["available", "unavailable"] as const
export type MenuAvailability = (typeof MENU_AVAILABILITY)[number]

/**
 * A named option for an item, e.g. "Half" / "Full". How a variant's price
 * relates to the item price (replace vs. add) is undecided (M3).
 */
export type MenuVariant = {
  id: string
  name: string
  price: Money
}

/** An optional extra, e.g. "Extra cheese". Grouping and limits are undecided (M4). */
export type MenuAddOn = {
  id: string
  name: string
  price: Money
}

export type MenuItem = {
  id: string
  name: string
  description: string | null
  /** Null when the item isn't in a category (whether that's allowed is M1). */
  categoryId: string | null
  categoryName: string | null
  price: Money
  imageUrl: string | null
  availability: MenuAvailability
  variants: MenuVariant[]
  addOns: MenuAddOn[]
}

export type MenuCategory = {
  id: string
  name: string
  description: string | null
  /** Display order, ascending. */
  position: number
  itemCount: number
}

export type MenuItemListQuery = {
  availability: MenuAvailability | "all"
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
