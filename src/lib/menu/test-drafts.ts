import type { CategoryDraft, MenuItemDraft } from "./validation"

/** Test helpers: minimal valid drafts, overridden per test. */
export function itemDraft(overrides: Partial<MenuItemDraft> = {}): MenuItemDraft {
  return {
    name: "Masala dosa",
    description: "",
    categoryId: "prv-cat-mains",
    price: "140",
    sizes: [],
    groups: [],
    dietary: "veg",
    allergens: [],
    spiceLevel: "none",
    tags: [],
    calories: "",
    channels: { delivery: true, takeaway: true, dine_in: true },
    soldOut: { state: "available" },
    schedule: { mode: "always" },
    image: { kind: "keep" },
    ...overrides,
  }
}

export function categoryDraft(overrides: Partial<CategoryDraft> = {}): CategoryDraft {
  return {
    name: "Snacks",
    description: "",
    active: true,
    channels: { delivery: true, takeaway: true, dine_in: true },
    ...overrides,
  }
}
