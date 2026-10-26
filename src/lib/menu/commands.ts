import { ORDER_TYPES } from "@/lib/domain/order-types"

import { mealPeriodDraftFromInput, validateMealPeriodDraft, type MealPeriodDraft } from "./meal-periods"
import { scheduleDraftFromInput } from "./schedule"
import type { ChannelSettings } from "./types"
import {
  hasErrors,
  isAllergen,
  isDietary,
  isItemTag,
  isSoldOutChoice,
  isSpiceLevel,
  SOLD_OUT_REASON_MAX,
  validateCategoryDraft,
  validateMenuItemDraft,
  type CategoryDraft,
  type FieldErrors,
  type GroupDraft,
  type ImageChange,
  type MenuItemDraft,
  type OptionDraft,
  type SizeDraft,
  type SoldOutChoice,
  type SoldOutDraft,
} from "./validation"

// Restaurant commands on the menu. Server Actions parse untrusted browser
// input with parseMenuCommand; the menu rules (rules.ts) then decide whether
// the command fits the current menu.

export type MenuCommand =
  | { type: "save_item"; itemId: string | null; draft: MenuItemDraft }
  | { type: "set_sold_out"; itemId: string; until: SoldOutChoice; reason: string }
  | { type: "set_available"; itemId: string }
  | { type: "archive_item" | "restore_item" | "delete_item"; itemId: string }
  | { type: "save_category"; categoryId: string | null; draft: CategoryDraft }
  | { type: "move_category"; categoryId: string; direction: "up" | "down" }
  | { type: "archive_category" | "restore_category" | "delete_category"; categoryId: string }
  /** B3b. `version` is the one loaded for editing; null for a new period. */
  | { type: "save_meal_period"; periodId: string | null; version: string | null; draft: MealPeriodDraft }
  | { type: "archive_meal_period" | "restore_meal_period" | "delete_meal_period"; periodId: string }

export type ParsedMenuCommand = { ok: true; command: MenuCommand } | { ok: false; fieldErrors: FieldErrors }

const ID_PATTERN = /^[\w-]{1,100}$/

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null
const text = (value: unknown, max = 2000) => (typeof value === "string" ? value.slice(0, max) : "")
const bool = (value: unknown) => value === true
const id = (value: unknown) => (typeof value === "string" && ID_PATTERN.test(value) ? value : null)
const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : [])

function channels(value: unknown): ChannelSettings {
  const raw = isRecord(value) ? value : {}
  return Object.fromEntries(ORDER_TYPES.map((type) => [type, bool(raw[type])])) as ChannelSettings
}

function sizeDraft(value: unknown): SizeDraft | null {
  if (!isRecord(value) || !id(value.key)) return null
  return { key: value.key as string, name: text(value.name, 200), price: text(value.price, 20), available: bool(value.available) }
}

function optionDraft(value: unknown): OptionDraft | null {
  if (!isRecord(value) || !id(value.key)) return null
  return { key: value.key as string, name: text(value.name, 200), price: text(value.price, 20), available: bool(value.available) }
}

function groupDraft(value: unknown): GroupDraft | null {
  if (!isRecord(value) || !id(value.key)) return null
  return {
    key: value.key as string,
    name: text(value.name, 200),
    selection: value.selection === "multiple" ? "multiple" : "single",
    required: bool(value.required),
    min: text(value.min, 5),
    max: text(value.max, 5),
    // Allow one past the limit so validation can report it.
    options: list(value.options, 21).map(optionDraft).filter((option): option is OptionDraft => option !== null),
  }
}

function imageChange(value: unknown): ImageChange {
  if (!isRecord(value)) return { kind: "keep" }
  if (value.kind === "remove") return { kind: "remove" }
  if (value.kind === "replace") return { kind: "replace", dataUrl: text(value.dataUrl, 1_000_000) }
  return { kind: "keep" }
}

function soldOutDraft(value: unknown): SoldOutDraft {
  if (!isRecord(value) || value.state !== "sold_out") return { state: "available" }
  return {
    state: "sold_out",
    until: value.until === "unchanged" ? "unchanged" : isSoldOutChoice(value.until) ? value.until : "manual",
    reason: text(value.reason, SOLD_OUT_REASON_MAX + 50),
  }
}

/** Builds a well-typed draft from untrusted input; validation runs afterwards. */
export function itemDraftFrom(value: unknown): MenuItemDraft {
  const raw = isRecord(value) ? value : {}
  return {
    name: text(raw.name, 500),
    description: text(raw.description, 1000),
    categoryId: id(raw.categoryId) ?? "",
    price: text(raw.price, 20),
    sizes: list(raw.sizes, 11).map(sizeDraft).filter((size): size is SizeDraft => size !== null),
    groups: list(raw.groups, 11).map(groupDraft).filter((group): group is GroupDraft => group !== null),
    dietary: isDietary(raw.dietary) ? raw.dietary : "veg",
    allergens: [...new Set(list(raw.allergens, 20).filter(isAllergen))],
    spiceLevel: isSpiceLevel(raw.spiceLevel) ? raw.spiceLevel : "none",
    tags: [...new Set(list(raw.tags, 10).filter(isItemTag))],
    calories: text(raw.calories, 10),
    channels: channels(raw.channels),
    soldOut: soldOutDraft(raw.soldOut),
    schedule: scheduleDraftFromInput(raw.schedule),
    image: imageChange(raw.image),
  }
}

export function categoryDraftFrom(value: unknown): CategoryDraft {
  const raw = isRecord(value) ? value : {}
  return {
    name: text(raw.name, 200),
    description: text(raw.description, 1000),
    active: raw.active !== false,
    channels: channels(raw.channels),
    // Not sent = keep the saved schedule, so a caller can't wipe it by leaving it out.
    ...(raw.schedule === undefined ? {} : { schedule: scheduleDraftFromInput(raw.schedule) }),
  }
}

const unknownCommand: ParsedMenuCommand = { ok: false, fieldErrors: { command: "Unknown action." } }

export function parseMenuCommand(input: unknown): ParsedMenuCommand {
  if (!isRecord(input)) return unknownCommand

  switch (input.type) {
    case "save_item": {
      const itemId = input.itemId === null ? null : id(input.itemId)
      if (itemId === null && input.itemId !== null) return unknownCommand
      const draft = itemDraftFrom(input.draft)
      const errors = validateMenuItemDraft(draft)
      return hasErrors(errors) ? { ok: false, fieldErrors: errors } : { ok: true, command: { type: "save_item", itemId, draft } }
    }

    case "set_sold_out": {
      const itemId = id(input.itemId)
      if (!itemId || !isSoldOutChoice(input.until)) return unknownCommand
      const reason = text(input.reason, 1000).trim()
      if (reason.length > SOLD_OUT_REASON_MAX) {
        return { ok: false, fieldErrors: { reason: `Keep the reason under ${SOLD_OUT_REASON_MAX} characters.` } }
      }
      return { ok: true, command: { type: "set_sold_out", itemId, until: input.until, reason } }
    }

    case "set_available":
    case "archive_item":
    case "restore_item":
    case "delete_item": {
      const itemId = id(input.itemId)
      return itemId ? { ok: true, command: { type: input.type, itemId } } : unknownCommand
    }

    case "save_category": {
      const categoryId = input.categoryId === null ? null : id(input.categoryId)
      if (categoryId === null && input.categoryId !== null) return unknownCommand
      const draft = categoryDraftFrom(input.draft)
      const errors = validateCategoryDraft(draft)
      return hasErrors(errors)
        ? { ok: false, fieldErrors: errors }
        : { ok: true, command: { type: "save_category", categoryId, draft } }
    }

    case "move_category": {
      const categoryId = id(input.categoryId)
      if (!categoryId || (input.direction !== "up" && input.direction !== "down")) return unknownCommand
      return { ok: true, command: { type: "move_category", categoryId, direction: input.direction } }
    }

    case "archive_category":
    case "restore_category":
    case "delete_category": {
      const categoryId = id(input.categoryId)
      return categoryId ? { ok: true, command: { type: input.type, categoryId } } : unknownCommand
    }

    case "save_meal_period": {
      const periodId = input.periodId === null ? null : id(input.periodId)
      if (periodId === null && input.periodId !== null) return unknownCommand
      // Editing needs the version that was loaded, so a stale edit can be refused.
      const version = typeof input.version === "string" && input.version.length <= 100 ? input.version : null
      if (periodId !== null && version === null) return unknownCommand
      const draft = mealPeriodDraftFromInput(input.draft)
      const errors = validateMealPeriodDraft(draft)
      return hasErrors(errors)
        ? { ok: false, fieldErrors: errors }
        : { ok: true, command: { type: "save_meal_period", periodId, version: periodId ? version : null, draft } }
    }

    case "archive_meal_period":
    case "restore_meal_period":
    case "delete_meal_period": {
      const periodId = id(input.periodId)
      return periodId ? { ok: true, command: { type: input.type, periodId } } : unknownCommand
    }

    default:
      return unknownCommand
  }
}
