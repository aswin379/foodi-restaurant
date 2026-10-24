import { ServiceError } from "@/lib/data-source/errors"
import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"

import type { MenuCommand } from "./commands"
import { scheduleFromDraft } from "./schedule"
import type { MenuCategory, MenuItem, OptionGroup, SoldOutState, SoldOutUntil } from "./types"
import { groupLimits, toMinor, type MenuItemDraft, type SoldOutChoice } from "./validation"

// Menu rules (PRD v0.3 §5, D7). One pure function applies every restaurant
// command to the menu, so the preview data source and (later) the backend
// contract tests follow the same rules. The real backend must enforce them
// itself; hiding a button is never the control.

export type StoredCategory = Omit<MenuCategory, "itemCount">
export type MenuState = { items: MenuItem[]; categories: StoredCategory[] }

export type MenuCommandResult =
  | { kind: "item"; item: MenuItem }
  | { kind: "category"; category: MenuCategory }
  | { kind: "item_deleted"; id: string; name: string }
  | { kind: "category_deleted"; id: string; name: string }

type ApplyContext = {
  now: Date
  /** Who made the change, as shown in sold-out details. */
  actor: string
  /** The restaurant's IANA time zone, stored with item schedules. */
  timeZone: string
  /** Mints ids for new records. */
  newId: (kind: "item" | "category" | "size" | "group" | "option") => string
}

export function withItemCount(category: StoredCategory, items: MenuItem[]): MenuCategory {
  return {
    ...category,
    itemCount: items.filter((item) => item.categoryId === category.id && !item.archived).length,
  }
}

// ----- Display status --------------------------------------------------------

export type ItemStatus =
  | { kind: "archived" }
  | { kind: "category_off" }
  | { kind: "sold_out"; until: SoldOutUntil }
  | { kind: "available"; offFor: OrderType[] }

/** What a menu row shows. Archived first, then category off, then sold out. */
export function itemStatus(item: MenuItem, category: Pick<MenuCategory, "active" | "channels"> | null): ItemStatus {
  if (item.archived) return { kind: "archived" }
  if (category && !category.active) return { kind: "category_off" }
  if (item.soldOut) return { kind: "sold_out", until: item.soldOut.until }
  const offFor = ORDER_TYPES.filter((type) => !item.channels[type] || (category ? !category.channels[type] : false))
  return { kind: "available", offFor }
}

/** The customer-facing starting price: the cheapest size, or the base price. */
export function displayPrice(item: Pick<MenuItem, "price" | "sizes">) {
  if (item.sizes.length === 0) return { from: false, price: item.price }
  const cheapest = item.sizes.reduce((low, size) => (size.price.amountMinor < low.price.amountMinor ? size : low))
  return { from: item.sizes.length > 1, price: cheapest.price }
}

// ----- Helpers ---------------------------------------------------------------

/** A refusal whose wording is written for the restaurant and shown to them. */
function refuse(kind: "conflict" | "validation" | "not_found", message: string, fieldErrors?: Record<string, string>) {
  return new ServiceError(kind, message, fieldErrors, message)
}

const HOUR = 60 * 60_000

function soldOutUntil(choice: SoldOutChoice, now: Date): SoldOutUntil {
  switch (choice) {
    case "for_1h":
      return { at: new Date(now.getTime() + HOUR).toISOString() }
    case "for_2h":
      return { at: new Date(now.getTime() + 2 * HOUR).toISOString() }
    case "for_4h":
      return { at: new Date(now.getTime() + 4 * HOUR).toISOString() }
    default:
      return choice
  }
}

function newSoldOut(choice: SoldOutChoice, reason: string, context: ApplyContext): SoldOutState {
  return {
    until: soldOutUntil(choice, context.now),
    reason: reason.trim() || null,
    since: context.now.toISOString(),
    by: context.actor,
  }
}

function findItem(state: MenuState, itemId: string) {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) throw refuse("not_found", "This item no longer exists.")
  return item
}

function findCategory(state: MenuState, categoryId: string) {
  const category = state.categories.find((candidate) => candidate.id === categoryId)
  if (!category) throw refuse("not_found", "This category no longer exists.")
  return category
}

function activeOnly(item: MenuItem) {
  if (item.archived) throw refuse("conflict", "Restore this item before changing it.")
}

function replaceItem(state: MenuState, item: MenuItem): MenuState {
  return { ...state, items: state.items.map((candidate) => (candidate.id === item.id ? item : candidate)) }
}

function replaceCategory(state: MenuState, category: StoredCategory): MenuState {
  return {
    ...state,
    categories: state.categories.map((candidate) => (candidate.id === category.id ? category : candidate)),
  }
}

const money = (amountMinor: number, currency: string) => ({ amountMinor, currency })

function itemFromDraft(
  draft: MenuItemDraft,
  existing: MenuItem | null,
  category: StoredCategory,
  currency: string,
  context: ApplyContext
): MenuItem {
  const existingIds = new Set([
    ...(existing?.sizes.map((size) => size.id) ?? []),
    ...(existing?.optionGroups.flatMap((group) => [group.id, ...group.options.map((option) => option.id)]) ?? []),
  ])
  const keep = (key: string, kind: "size" | "group" | "option") => (existingIds.has(key) ? key : context.newId(kind))

  const sizes = draft.sizes.map((size) => ({
    id: keep(size.key, "size"),
    name: size.name.trim(),
    price: money(toMinor(size.price), currency),
    available: size.available,
  }))

  const optionGroups: OptionGroup[] = draft.groups.map((group) => {
    const { min, max } = groupLimits(group)
    return {
      id: keep(group.key, "group"),
      name: group.name.trim(),
      selection: group.selection,
      required: group.required,
      min: min ?? 0,
      max: max ?? 1,
      options: group.options.map((option) => ({
        id: keep(option.key, "option"),
        name: option.name.trim(),
        price: money(toMinor(option.price || "0"), currency),
        available: option.available,
      })),
    }
  })

  // With sizes, the base price follows the cheapest size (shown as "From …").
  const price = sizes.length
    ? sizes.reduce((low, size) => (size.price.amountMinor < low.amountMinor ? size.price : low), sizes[0].price)
    : money(toMinor(draft.price), currency)

  const soldOut =
    draft.soldOut.state === "available"
      ? null
      : draft.soldOut.until === "unchanged" && existing?.soldOut
        ? { ...existing.soldOut, reason: draft.soldOut.reason.trim() || null }
        : newSoldOut(
            draft.soldOut.until === "unchanged" ? "manual" : draft.soldOut.until,
            draft.soldOut.reason,
            context
          )

  return {
    id: existing?.id ?? context.newId("item"),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    categoryId: category.id,
    categoryName: category.name,
    price,
    sizes,
    optionGroups,
    imageUrl:
      draft.image.kind === "keep"
        ? (existing?.imageUrl ?? null)
        : draft.image.kind === "remove"
          ? null
          : draft.image.dataUrl,
    dietary: draft.dietary,
    allergens: draft.allergens,
    spiceLevel: draft.spiceLevel,
    tags: draft.tags,
    calories: draft.calories.trim() ? Number(draft.calories.trim()) : null,
    soldOut,
    channels: draft.channels,
    // Stamped with the restaurant's zone here, never taken from the browser.
    schedule: scheduleFromDraft(draft.schedule, context.timeZone),
    archived: false,
    usedOnOrders: existing?.usedOnOrders ?? false,
  }
}

function activeCategoriesInOrder(state: MenuState) {
  return state.categories.filter((category) => !category.archived).sort((a, b) => a.position - b.position)
}

// ----- Commands --------------------------------------------------------------

/**
 * Applies one command to the whole menu and returns the new menu plus what
 * changed. Throws ServiceError for anything the rules don't allow.
 */
export function applyMenuCommand(
  state: MenuState,
  command: MenuCommand,
  context: ApplyContext,
  currency = "INR"
): { state: MenuState; result: MenuCommandResult } {
  const itemResult = (next: MenuState, item: MenuItem) => ({ state: next, result: { kind: "item" as const, item } })
  const categoryResult = (next: MenuState, category: StoredCategory) => ({
    state: next,
    result: { kind: "category" as const, category: withItemCount(category, next.items) },
  })

  switch (command.type) {
    case "save_item": {
      const existing = command.itemId ? findItem(state, command.itemId) : null
      if (existing) activeOnly(existing)
      const category = state.categories.find((candidate) => candidate.id === command.draft.categoryId)
      if (!category || category.archived) {
        throw refuse("validation", "Choose an active category.", {
          categoryId: "Choose an active category. Every item needs one.",
        })
      }
      const item = itemFromDraft(command.draft, existing, category, currency, context)
      const next = existing ? replaceItem(state, item) : { ...state, items: [...state.items, item] }
      return itemResult(next, item)
    }

    case "set_sold_out": {
      const item = findItem(state, command.itemId)
      activeOnly(item)
      const updated = { ...item, soldOut: newSoldOut(command.until, command.reason, context) }
      return itemResult(replaceItem(state, updated), updated)
    }

    case "set_available": {
      const item = findItem(state, command.itemId)
      activeOnly(item)
      const updated = { ...item, soldOut: null }
      return itemResult(replaceItem(state, updated), updated)
    }

    case "archive_item": {
      const item = findItem(state, command.itemId)
      if (item.archived) throw refuse("conflict", "This item is already archived.")
      const updated = { ...item, archived: true }
      return itemResult(replaceItem(state, updated), updated)
    }

    case "restore_item": {
      const item = findItem(state, command.itemId)
      if (!item.archived) throw refuse("conflict", "This item isn't archived.")
      const category = state.categories.find((candidate) => candidate.id === item.categoryId)
      if (!category || category.archived) {
        // D7: an active item must be in an active category.
        throw refuse("conflict", `Restore the ${item.categoryName} category first.`)
      }
      const updated = { ...item, archived: false }
      return itemResult(replaceItem(state, updated), updated)
    }

    case "delete_item": {
      const item = findItem(state, command.itemId)
      if (item.usedOnOrders) {
        throw refuse("conflict", "This item has been ordered before, so it can only be archived.")
      }
      return {
        state: { ...state, items: state.items.filter((candidate) => candidate.id !== item.id) },
        result: { kind: "item_deleted", id: item.id, name: item.name },
      }
    }

    case "save_category": {
      const existing = command.categoryId ? findCategory(state, command.categoryId) : null
      if (existing?.archived) throw refuse("conflict", "Restore this category before changing it.")
      const name = command.draft.name.trim()
      const clash = state.categories.some(
        (category) => !category.archived && category.id !== existing?.id && category.name.toLowerCase() === name.toLowerCase()
      )
      if (clash) {
        throw refuse("validation", "Another category has this name.", {
          name: "Another category already has this name.",
        })
      }
      const positions = state.categories.map((category) => category.position)
      const saved: StoredCategory = {
        id: existing?.id ?? context.newId("category"),
        name,
        description: command.draft.description.trim() || null,
        position: existing?.position ?? Math.max(0, ...positions) + 1,
        active: command.draft.active,
        channels: command.draft.channels,
        archived: false,
        usedOnOrders: existing?.usedOnOrders ?? false,
      }
      let next = existing ? replaceCategory(state, saved) : { ...state, categories: [...state.categories, saved] }
      // Items show their category's name, so keep it in step.
      if (existing && existing.name !== saved.name) {
        next = {
          ...next,
          items: next.items.map((item) => (item.categoryId === saved.id ? { ...item, categoryName: saved.name } : item)),
        }
      }
      return categoryResult(next, saved)
    }

    case "move_category": {
      const category = findCategory(state, command.categoryId)
      if (category.archived) throw refuse("conflict", "Archived categories aren't in the menu order.")
      const ordered = activeCategoriesInOrder(state)
      const index = ordered.findIndex((candidate) => candidate.id === category.id)
      const neighbour = ordered[command.direction === "up" ? index - 1 : index + 1]
      if (!neighbour) {
        throw refuse(
          "conflict",
          command.direction === "up" ? "This category is already first." : "This category is already last."
        )
      }
      const moved = { ...category, position: neighbour.position }
      const swapped = { ...neighbour, position: category.position }
      return categoryResult(replaceCategory(replaceCategory(state, moved), swapped), moved)
    }

    case "archive_category": {
      const category = findCategory(state, command.categoryId)
      if (category.archived) throw refuse("conflict", "This category is already archived.")
      const activeItems = state.items.filter((item) => item.categoryId === category.id && !item.archived).length
      if (activeItems > 0) {
        throw refuse(
          "conflict",
          `Move or archive its ${activeItems} ${activeItems === 1 ? "item" : "items"} first.`
        )
      }
      const updated = { ...category, archived: true }
      return categoryResult(replaceCategory(state, updated), updated)
    }

    case "restore_category": {
      const category = findCategory(state, command.categoryId)
      if (!category.archived) throw refuse("conflict", "This category isn't archived.")
      const positions = state.categories.map((candidate) => candidate.position)
      const updated = { ...category, archived: false, position: Math.max(0, ...positions) + 1 }
      return categoryResult(replaceCategory(state, updated), updated)
    }

    case "delete_category": {
      const category = findCategory(state, command.categoryId)
      const items = state.items.filter((item) => item.categoryId === category.id)
      const active = items.filter((item) => !item.archived).length
      if (active > 0) {
        throw refuse("conflict", `Move or archive its ${active} ${active === 1 ? "item" : "items"} first.`)
      }
      // Archived items keep their last category for history (D7).
      if (category.usedOnOrders || items.length > 0) {
        throw refuse("conflict", "This category has order history, so it can only be archived.")
      }
      return {
        state: { ...state, categories: state.categories.filter((candidate) => candidate.id !== category.id) },
        result: { kind: "category_deleted", id: category.id, name: category.name },
      }
    }
  }
}
