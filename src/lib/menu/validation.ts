import { ORDER_TYPES } from "@/lib/domain/order-types"

import { validateScheduleDraft, type ScheduleDraft } from "./schedule"
import {
  ALLERGENS,
  DIETARY_TYPES,
  ITEM_TAGS,
  SPICE_LEVELS,
  type Allergen,
  type ChannelSettings,
  type DietaryType,
  type ItemTag,
  type SpiceLevel,
} from "./types"

// Item and category form rules (PRD v0.3 §5, D7). The same functions run in
// the browser and in the Server Actions, so both report the same errors.
// Errors are keyed by field path (e.g. "groups.<key>.max"); the form turns a
// path into the matching field id with fieldId().

export const ITEM_NAME_MAX = 120
export const DESCRIPTION_MAX = 500
export const CATEGORY_NAME_MAX = 60
export const OPTION_NAME_MAX = 60
export const SOLD_OUT_REASON_MAX = 120
export const MAX_SIZES = 10
export const MAX_GROUPS = 10
export const MAX_OPTIONS_PER_GROUP = 20
export const CALORIES_MAX = 5000
/** PRD §5: uploads up to 2 MB, JPG, PNG or WebP. */
export const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
/** The browser sends a square, compressed copy; this caps what it may send. */
export const IMAGE_STORED_MAX_BYTES = 700 * 1024

// Up to 999999.99 with at most two decimals.
const PRICE_PATTERN = /^\d{1,6}(\.\d{1,2})?$/
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/

export type SizeDraft = { key: string; name: string; price: string; available: boolean }
export type OptionDraft = { key: string; name: string; price: string; available: boolean }
export type GroupDraft = {
  key: string
  name: string
  selection: "single" | "multiple"
  required: boolean
  /** Only used for multiple choice; single choice is always min 0/1, max 1. */
  min: string
  max: string
  options: OptionDraft[]
}

export type ImageChange = { kind: "keep" } | { kind: "remove" } | { kind: "replace"; dataUrl: string }

export const SOLD_OUT_CHOICES = ["next_opening", "end_of_day", "for_1h", "for_2h", "for_4h", "manual"] as const
export type SoldOutChoice = (typeof SOLD_OUT_CHOICES)[number]

export type SoldOutDraft =
  | { state: "available" }
  | { state: "sold_out"; until: SoldOutChoice | "unchanged"; reason: string }

export type MenuItemDraft = {
  name: string
  description: string
  categoryId: string
  price: string
  sizes: SizeDraft[]
  groups: GroupDraft[]
  dietary: DietaryType
  allergens: Allergen[]
  spiceLevel: SpiceLevel
  tags: ItemTag[]
  calories: string
  channels: ChannelSettings
  soldOut: SoldOutDraft
  schedule: ScheduleDraft
  image: ImageChange
}

export type CategoryDraft = {
  name: string
  description: string
  active: boolean
  channels: ChannelSettings
}

export type FieldErrors = Record<string, string>

/** DOM id for a field path, e.g. "groups.k1.max" → "item-groups-k1-max". */
export function fieldId(path: string, prefix = "item") {
  return `${prefix}-${path.replace(/\./g, "-")}`
}

export function priceError(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) return `Enter ${label}.`
  if (!PRICE_PATTERN.test(trimmed)) {
    return `Enter ${label} as a number with up to two decimals, like 120 or 120.50.`
  }
  return undefined
}

/** A valid price input to minor units (paise). */
export function toMinor(value: string) {
  return Math.round(Number(value.trim()) * 100)
}

/** Minor units (paise) to the plain decimal string used by the price inputs. */
export function toPriceInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "")
}

function nameError(value: string, label: string, max: number) {
  const name = value.trim()
  if (!name) return `Enter the ${label}.`
  if (name.length > max) return `Keep the ${label} under ${max} characters.`
  return undefined
}

function wholeNumber(value: string) {
  return /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : null
}

/** Effective min/max for a group, after the single-choice rules. */
export function groupLimits(group: GroupDraft): { min: number | null; max: number | null } {
  if (group.selection === "single") return { min: group.required ? 1 : 0, max: 1 }
  return { min: group.required ? wholeNumber(group.min) : 0, max: wholeNumber(group.max) }
}

function channelsError(channels: ChannelSettings) {
  return ORDER_TYPES.some((type) => channels[type]) ? undefined : "Turn on at least one order type."
}

function duplicates(names: string[]) {
  const seen = new Set<string>()
  const repeated = new Set<number>()
  names.forEach((name, index) => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return
    if (seen.has(normalized)) repeated.add(index)
    seen.add(normalized)
  })
  return repeated
}

/** Decoded size in bytes of a base64 image data URL, or null if it isn't one. */
export function imageDataUrlBytes(dataUrl: string) {
  const match = IMAGE_DATA_URL.exec(dataUrl)
  if (!match) return null
  const base64 = match[2]
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0)
}

export function validateMenuItemDraft(draft: MenuItemDraft): FieldErrors {
  const errors: FieldErrors = {}
  const set = (path: string, message: string | undefined) => {
    if (message) errors[path] = message
  }

  set("name", nameError(draft.name, "item name", ITEM_NAME_MAX))
  if (draft.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  }
  // D7: every active item belongs to exactly one category.
  if (!draft.categoryId) errors.categoryId = "Choose a category. Every item needs one."

  // Sizes replace the base price, so the price is only needed without sizes.
  if (draft.sizes.length === 0) set("price", priceError(draft.price, "the price"))
  if (draft.sizes.length > MAX_SIZES) errors.sizes = `Use at most ${MAX_SIZES} sizes.`
  const repeatedSizes = duplicates(draft.sizes.map((size) => size.name))
  draft.sizes.forEach((size, index) => {
    set(`sizes.${size.key}.name`, nameError(size.name, "size name", OPTION_NAME_MAX))
    if (repeatedSizes.has(index)) errors[`sizes.${size.key}.name`] = "Each size needs a different name."
    set(`sizes.${size.key}.price`, priceError(size.price, "the size price"))
  })

  if (draft.groups.length > MAX_GROUPS) errors.groups = `Use at most ${MAX_GROUPS} option groups.`
  const repeatedGroups = duplicates(draft.groups.map((group) => group.name))
  draft.groups.forEach((group, index) => {
    const path = `groups.${group.key}`
    set(`${path}.name`, nameError(group.name, "group name", OPTION_NAME_MAX))
    if (repeatedGroups.has(index)) errors[`${path}.name`] = "Each group needs a different name."

    const count = group.options.length
    if (count === 0) errors[`${path}.options`] = "Add at least one option."
    if (count > MAX_OPTIONS_PER_GROUP) errors[`${path}.options`] = `Use at most ${MAX_OPTIONS_PER_GROUP} options.`

    const { min, max } = groupLimits(group)
    if (group.selection === "multiple") {
      if (max === null || max < 1) errors[`${path}.max`] = "Enter the most a customer can choose (1 or more)."
      else if (count > 0 && max > count) errors[`${path}.max`] = `Can't be more than the ${count} options.`
      if (group.required) {
        if (min === null || min < 1) errors[`${path}.min`] = "Enter the fewest a customer must choose (1 or more)."
        else if (max !== null && min > max) errors[`${path}.min`] = "Can't be more than the maximum."
      }
    } else if (group.required && count > 0 && group.options.every((option) => !option.available)) {
      errors[`${path}.options`] = "A required group needs at least one available option."
    }

    const repeatedOptions = duplicates(group.options.map((option) => option.name))
    group.options.forEach((option, optionIndex) => {
      const optionPath = `${path}.options.${option.key}`
      set(`${optionPath}.name`, nameError(option.name, "option name", OPTION_NAME_MAX))
      if (repeatedOptions.has(optionIndex)) errors[`${optionPath}.name`] = "Each option needs a different name."
      set(`${optionPath}.price`, priceError(option.price || "0", "the added price"))
    })
  })

  const calories = draft.calories.trim()
  if (calories && (!/^\d{1,4}$/.test(calories) || Number(calories) > CALORIES_MAX)) {
    errors.calories = `Enter calories as a whole number up to ${CALORIES_MAX}.`
  }

  set("channels", channelsError(draft.channels))
  Object.assign(errors, validateScheduleDraft(draft.schedule, draft.channels))

  if (draft.soldOut.state === "sold_out" && draft.soldOut.reason.trim().length > SOLD_OUT_REASON_MAX) {
    errors["soldOut.reason"] = `Keep the reason under ${SOLD_OUT_REASON_MAX} characters.`
  }

  if (draft.image.kind === "replace") {
    const bytes = imageDataUrlBytes(draft.image.dataUrl)
    if (bytes === null) errors.image = "Choose a JPG, PNG or WebP image."
    else if (bytes > IMAGE_STORED_MAX_BYTES) errors.image = "This image is too large after compression. Try a smaller one."
  }

  return errors
}

export function validateCategoryDraft(draft: CategoryDraft): FieldErrors {
  const errors: FieldErrors = {}
  const name = nameError(draft.name, "category name", CATEGORY_NAME_MAX)
  if (name) errors.name = name
  if (draft.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  }
  const channels = channelsError(draft.channels)
  if (channels) errors.channels = channels
  return errors
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0

// Narrowing helpers for untrusted input.
export const isDietary = (value: unknown): value is DietaryType =>
  (DIETARY_TYPES as readonly unknown[]).includes(value)
export const isSpiceLevel = (value: unknown): value is SpiceLevel =>
  (SPICE_LEVELS as readonly unknown[]).includes(value)
export const isAllergen = (value: unknown): value is Allergen => (ALLERGENS as readonly unknown[]).includes(value)
export const isItemTag = (value: unknown): value is ItemTag => (ITEM_TAGS as readonly unknown[]).includes(value)
export const isSoldOutChoice = (value: unknown): value is SoldOutChoice =>
  (SOLD_OUT_CHOICES as readonly unknown[]).includes(value)
