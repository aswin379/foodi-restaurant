// Client-side checks for the item and category forms. They only describe
// well-formed input; business rules (required categories, variant limits,
// price semantics) are deliberately not enforced until approved.

export const ITEM_NAME_MAX = 120
export const DESCRIPTION_MAX = 500
export const CATEGORY_NAME_MAX = 60
export const OPTION_NAME_MAX = 60

// Up to 999999.99 with at most two decimals.
const PRICE_PATTERN = /^\d{1,6}(\.\d{1,2})?$/

export type OptionDraft = { key: string; name: string; price: string }

export type MenuItemDraft = {
  name: string
  description: string
  categoryId: string
  price: string
  available: boolean
  variants: OptionDraft[]
  addOns: OptionDraft[]
}

export type OptionErrors = Record<string, { name?: string; price?: string }>

export type MenuItemErrors = {
  name?: string
  description?: string
  price?: string
  variants?: OptionErrors
  addOns?: OptionErrors
}

export function priceError(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) return `Enter ${label}.`
  if (!PRICE_PATTERN.test(trimmed)) {
    return `Enter ${label} as a number with up to two decimals, like 120 or 120.50.`
  }
  return undefined
}

function optionErrors(options: OptionDraft[], kind: string): OptionErrors | undefined {
  const errors: OptionErrors = {}
  for (const option of options) {
    const name = option.name.trim()
    const entry: { name?: string; price?: string } = {}
    if (!name) entry.name = `Enter the ${kind} name.`
    else if (name.length > OPTION_NAME_MAX) entry.name = `Keep the name under ${OPTION_NAME_MAX} characters.`
    const price = priceError(option.price, "a price")
    if (price) entry.price = price
    if (entry.name || entry.price) errors[option.key] = entry
  }
  return Object.keys(errors).length ? errors : undefined
}

export function validateMenuItemDraft(draft: MenuItemDraft): MenuItemErrors {
  const errors: MenuItemErrors = {}
  const name = draft.name.trim()
  if (!name) errors.name = "Enter the item name."
  else if (name.length > ITEM_NAME_MAX) errors.name = `Keep the name under ${ITEM_NAME_MAX} characters.`

  if (draft.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  }

  const price = priceError(draft.price, "the price")
  if (price) errors.price = price

  const variants = optionErrors(draft.variants, "variant")
  if (variants) errors.variants = variants
  const addOns = optionErrors(draft.addOns, "add-on")
  if (addOns) errors.addOns = addOns
  return errors
}

export function hasErrors(errors: MenuItemErrors) {
  return Boolean(
    errors.name || errors.description || errors.price || errors.variants || errors.addOns
  )
}

export type CategoryDraft = { name: string; description: string }
export type CategoryErrors = { name?: string; description?: string }

export function validateCategoryDraft(draft: CategoryDraft): CategoryErrors {
  const errors: CategoryErrors = {}
  const name = draft.name.trim()
  if (!name) errors.name = "Enter the category name."
  else if (name.length > CATEGORY_NAME_MAX) errors.name = `Keep the name under ${CATEGORY_NAME_MAX} characters.`
  if (draft.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  }
  return errors
}

/** Minor units (paise) to the plain decimal string used by the price inputs. */
export function toPriceInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "")
}
