import type { Money } from "@/lib/orders/types"
import type { MenuItem } from "@/lib/menu/types"

/** One line of the order being built. Held in the browser only: nothing here is sent anywhere. */
export type CartLine = {
  key: string
  itemId: string
  name: string
  /** Size and options, formatted for display. */
  options: string[]
  note: string
  quantity: number
  /** Price of one, in minor units, from the menu data shown on screen. */
  unitMinor: number
  currency: string
}

export type Selection = {
  sizeId: string | null
  /** Option ids chosen, by option group id. */
  options: Record<string, string[]>
  quantity: number
  note: string
}

export const money = (amountMinor: number, currency: string): Money => ({ amountMinor, currency })

/** Whether an item needs the modifier dialog before it can be added. */
export const needsChoices = (item: MenuItem) => item.sizes.length > 0 || item.optionGroups.length > 0

/** Group-by-group problems with a selection, using the group's own rules (required, min, max). */
export function selectionProblems(item: MenuItem, selection: Selection): string[] {
  const problems: string[] = []
  if (item.sizes.length > 0 && !selection.sizeId) problems.push("Choose a size.")
  for (const group of item.optionGroups) {
    const chosen = selection.options[group.id]?.length ?? 0
    const min = group.required ? Math.max(group.min, 1) : group.min
    if (chosen < min) problems.push(`Choose ${min === 1 ? "an option" : `at least ${min} options`} for ${group.name}.`)
    if (chosen > group.max) problems.push(`Choose at most ${group.max} for ${group.name}.`)
  }
  return problems
}

/** The line a valid selection adds. The price is the menu price shown on screen: Foodi works out the real total. */
export function lineFrom(item: MenuItem, selection: Selection, key: string): CartLine {
  const size = item.sizes.find((candidate) => candidate.id === selection.sizeId) ?? null
  const chosen = item.optionGroups.flatMap((group) =>
    group.options.filter((option) => selection.options[group.id]?.includes(option.id))
  )
  const unit = (size ? size.price.amountMinor : item.price.amountMinor) + chosen.reduce((sum, option) => sum + option.price.amountMinor, 0)
  return {
    key,
    itemId: item.id,
    name: item.name,
    options: [...(size ? [size.name] : []), ...chosen.map((option) => option.name)],
    note: selection.note.trim(),
    quantity: selection.quantity,
    unitMinor: unit,
    currency: item.price.currency,
  }
}

export const lineTotal = (line: CartLine) => line.unitMinor * line.quantity
export const subtotal = (lines: CartLine[]) => lines.reduce((sum, line) => sum + lineTotal(line), 0)
