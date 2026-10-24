import "server-only"

import type { MenuAddOn, MenuCategory, MenuItem, MenuVariant } from "../types"

// DEVELOPMENT FIXTURES ONLY. An illustrative menu for previewing the UI while
// the menu API is built. Pages show a preview notice whenever this data is
// on screen, ids start with "prv-", and descriptions say they are previews.
// Variant and add-on prices are examples, not approved pricing rules.
// Never import this file outside src/lib/menu/fixtures.

const CURRENCY = "INR"
const money = (amountMinor: number) => ({ amountMinor, currency: CURRENCY })

const CATEGORIES: Omit<MenuCategory, "itemCount">[] = [
  { id: "prv-cat-starters", name: "Starters", description: "Small plates (preview)", position: 1 },
  { id: "prv-cat-mains", name: "Mains", description: null, position: 2 },
  { id: "prv-cat-breads", name: "Breads", description: null, position: 3 },
  { id: "prv-cat-rice", name: "Rice & biryani", description: "Preview description", position: 4 },
  { id: "prv-cat-desserts", name: "Desserts", description: null, position: 5 },
  { id: "prv-cat-drinks", name: "Drinks", description: "Hot and cold drinks (preview)", position: 6 },
  // Deliberately empty, to preview a category without items.
  { id: "prv-cat-seasonal", name: "Seasonal specials", description: "No items yet (preview)", position: 7 },
]

type Seed = [name: string, categoryId: string, priceMinor: number, available?: boolean]

const ITEMS: Seed[] = [
  ["Paneer tikka", "prv-cat-starters", 26000],
  ["Veg spring rolls", "prv-cat-starters", 18000],
  ["Chicken 65", "prv-cat-starters", 24000, false],
  ["Hara bhara kebab", "prv-cat-starters", 19000],
  ["Dal makhani", "prv-cat-mains", 19000],
  ["Paneer butter masala", "prv-cat-mains", 24000],
  ["Butter chicken", "prv-cat-mains", 29000],
  ["Kadai vegetables", "prv-cat-mains", 21000, false],
  ["Malai kofta", "prv-cat-mains", 23000],
  ["Butter naan", "prv-cat-breads", 6000],
  ["Garlic naan", "prv-cat-breads", 7000],
  ["Tandoori roti", "prv-cat-breads", 3000],
  ["Lachha paratha", "prv-cat-breads", 6000, false],
  ["Veg biryani", "prv-cat-rice", 22000],
  ["Chicken biryani", "prv-cat-rice", 28000],
  ["Jeera rice", "prv-cat-rice", 14000],
  ["Lemon rice", "prv-cat-rice", 12000],
  ["Gulab jamun (2 pcs)", "prv-cat-desserts", 9000],
  ["Rasmalai", "prv-cat-desserts", 11000],
  ["Kulfi", "prv-cat-desserts", 8000, false],
  ["Filter coffee", "prv-cat-drinks", 5000],
  ["Masala chai", "prv-cat-drinks", 4000],
  ["Sweet lassi", "prv-cat-drinks", 9000],
  ["Fresh lime soda", "prv-cat-drinks", 7000],
  // Not in a category, to preview how uncategorised items appear (M1).
  ["Chef's tasting platter", "", 49000],
]

const VARIANTS: Record<string, MenuVariant[]> = {
  "Veg biryani": [
    { id: "prv-var-1", name: "Half", price: money(14000) },
    { id: "prv-var-2", name: "Full", price: money(22000) },
  ],
  "Chicken biryani": [
    { id: "prv-var-3", name: "Half", price: money(18000) },
    { id: "prv-var-4", name: "Full", price: money(28000) },
  ],
  "Sweet lassi": [
    { id: "prv-var-5", name: "Regular", price: money(9000) },
    { id: "prv-var-6", name: "Large", price: money(12000) },
  ],
}

const ADD_ONS: Record<string, MenuAddOn[]> = {
  "Paneer butter masala": [{ id: "prv-add-1", name: "Extra paneer", price: money(6000) }],
  "Butter chicken": [{ id: "prv-add-2", name: "Extra gravy", price: money(4000) }],
  "Veg biryani": [
    { id: "prv-add-3", name: "Raita", price: money(3000) },
    { id: "prv-add-4", name: "Boiled egg", price: money(2000) },
  ],
  "Butter naan": [{ id: "prv-add-5", name: "Extra butter", price: money(1000) }],
}

export function buildFixtureMenu(): { categories: MenuCategory[]; items: MenuItem[] } {
  const categoryName = new Map(CATEGORIES.map((category) => [category.id, category.name]))
  const items: MenuItem[] = ITEMS.map(([name, categoryId, priceMinor, available = true], index) => ({
    id: `prv-item-${String(index + 1).padStart(2, "0")}`,
    name,
    description: "Preview description · illustrative menu item, not a real listing.",
    categoryId: categoryId || null,
    categoryName: categoryId ? (categoryName.get(categoryId) ?? null) : null,
    price: money(priceMinor),
    imageUrl: null,
    availability: available ? "available" : "unavailable",
    variants: VARIANTS[name] ?? [],
    addOns: ADD_ONS[name] ?? [],
  }))

  const categories = CATEGORIES.map((category) => ({
    ...category,
    itemCount: items.filter((item) => item.categoryId === category.id).length,
  }))
  return { categories, items }
}
