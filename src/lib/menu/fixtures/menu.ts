import "server-only"

import type { OrderType } from "@/lib/domain/order-types"

import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { MenuState, StoredCategory } from "../rules"
import { enabledChannels, type ItemSchedule, type Weekday } from "../schedule"
import type {
  Allergen,
  ChannelSettings,
  DietaryType,
  ItemTag,
  MenuItem,
  MenuSize,
  OptionGroup,
  SpiceLevel,
} from "../types"

// DEVELOPMENT PREVIEW DATA ONLY. An illustrative menu for previewing the UI
// while the menu API is built. Ids start with "prv-", descriptions say they
// are previews, and "used on orders" flags are invented for testing archive
// and delete. Prices and option rules are examples, not approved pricing.
// Only src/lib/menu/preview-source.ts may import this file.

const CURRENCY = "INR"
const money = (amountMinor: number) => ({ amountMinor, currency: CURRENCY })
const ALL_CHANNELS: ChannelSettings = { delivery: true, takeaway: true, dine_in: true }
const channelsWithout = (...off: OrderType[]): ChannelSettings => ({
  ...ALL_CHANNELS,
  ...Object.fromEntries(off.map((type) => [type, false])),
})

const CATEGORIES: StoredCategory[] = [
  { id: "prv-cat-starters", name: "Starters", description: "Small plates (preview)", position: 1 },
  { id: "prv-cat-mains", name: "Mains", description: null, position: 2 },
  { id: "prv-cat-breads", name: "Breads", description: null, position: 3 },
  { id: "prv-cat-rice", name: "Rice & biryani", description: "Preview description", position: 4 },
  { id: "prv-cat-desserts", name: "Desserts", description: null, position: 5 },
  { id: "prv-cat-drinks", name: "Drinks", description: "Hot and cold drinks (preview)", position: 6 },
  // Switched off, to preview items in an inactive category.
  { id: "prv-cat-breakfast", name: "Breakfast", description: "Switched off (preview)", position: 7, active: false },
  // Deliberately empty, so it can be archived or deleted.
  { id: "prv-cat-seasonal", name: "Seasonal specials", description: "No items yet (preview)", position: 8, usedOnOrders: false },
  // Archived, with order history.
  { id: "prv-cat-festive", name: "Festive menu", description: "Archived (preview)", position: 9, archived: true },
].map((category) => ({
  active: true,
  channels: ALL_CHANNELS,
  archived: false,
  usedOnOrders: true,
  ...category,
}))

type Seed = {
  name: string
  categoryId: string
  priceMinor: number
  dietary?: DietaryType
  spiceLevel?: SpiceLevel
  tags?: ItemTag[]
  allergens?: Allergen[]
  calories?: number
  soldOut?: boolean
  channels?: ChannelSettings
  archived?: boolean
  /** Never ordered, so it can be deleted rather than archived. */
  neverOrdered?: boolean
  /** Order types left out apply to all of the item's order types. */
  schedule?: Array<[days: Weekday[], rule: { allDay?: OrderType[]; windows?: Array<[string, string, OrderType[]?]> }]>
}

// Sample schedules use the preview restaurant's own time zone (PRD §3.2).
function sampleSchedule(groups: Seed["schedule"], itemChannels: ChannelSettings): ItemSchedule {
  if (!groups) return { mode: "always" }
  const all = enabledChannels(itemChannels)
  return {
    mode: "custom",
    timeZone: PREVIEW_RESTAURANT.timeZone,
    weekly: groups.map(([days, rule]) => ({
      days,
      allDay: rule.allDay ? { channels: rule.allDay } : null,
      windows: (rule.windows ?? []).map(([start, end, channels]) => ({ start, end, channels: channels ?? all })),
    })),
  }
}

const WEEKDAYS_ONLY: Weekday[] = ["mon", "tue", "wed", "thu", "fri"]

const ITEMS: Seed[] = [
  { name: "Paneer tikka", categoryId: "prv-cat-starters", priceMinor: 26000, allergens: ["dairy"], tags: ["bestseller"], spiceLevel: "medium" },
  { name: "Veg spring rolls", categoryId: "prv-cat-starters", priceMinor: 18000, allergens: ["gluten"] },
  { name: "Chicken 65", categoryId: "prv-cat-starters", priceMinor: 24000, dietary: "non_veg", spiceLevel: "hot", soldOut: true },
  { name: "Hara bhara kebab", categoryId: "prv-cat-starters", priceMinor: 19000, dietary: "vegan", neverOrdered: true },
  { name: "Dal makhani", categoryId: "prv-cat-mains", priceMinor: 19000, allergens: ["dairy"], calories: 420 },
  { name: "Paneer butter masala", categoryId: "prv-cat-mains", priceMinor: 24000, allergens: ["dairy", "nuts"], tags: ["chefs_special"] },
  {
    name: "Butter chicken",
    categoryId: "prv-cat-mains",
    priceMinor: 29000,
    dietary: "non_veg",
    allergens: ["dairy"],
    tags: ["bestseller"],
    // Different order types on separate windows of the same day (Q12).
    schedule: [
      [WEEKDAYS_ONLY, { windows: [["11:00", "15:00", ["takeaway", "dine_in"]], ["18:00", "22:00", ["delivery"]]] }],
    ],
  },
  { name: "Kadai vegetables", categoryId: "prv-cat-mains", priceMinor: 21000, spiceLevel: "medium", soldOut: true },
  { name: "Egg curry", categoryId: "prv-cat-mains", priceMinor: 18000, dietary: "egg", allergens: ["egg"], channels: channelsWithout("dine_in") },
  { name: "Butter naan", categoryId: "prv-cat-breads", priceMinor: 6000, allergens: ["gluten", "dairy"] },
  { name: "Garlic naan", categoryId: "prv-cat-breads", priceMinor: 7000, allergens: ["gluten", "dairy"] },
  { name: "Tandoori roti", categoryId: "prv-cat-breads", priceMinor: 3000, dietary: "vegan", allergens: ["gluten"] },
  { name: "Veg biryani", categoryId: "prv-cat-rice", priceMinor: 22000, spiceLevel: "medium" },
  {
    name: "Chicken biryani",
    categoryId: "prv-cat-rice",
    priceMinor: 28000,
    dietary: "non_veg",
    spiceLevel: "medium",
    tags: ["bestseller"],
    schedule: [
      [WEEKDAYS_ONLY, { windows: [["12:00", "15:30"], ["19:00", "23:00"]] }],
      [["sat", "sun"], { windows: [["12:00", "23:30"]] }],
    ],
  },
  { name: "Lemon rice", categoryId: "prv-cat-rice", priceMinor: 12000, dietary: "vegan", allergens: ["peanuts", "mustard"] },
  { name: "Gulab jamun (2 pcs)", categoryId: "prv-cat-desserts", priceMinor: 9000, allergens: ["dairy", "gluten"] },
  { name: "Rasmalai", categoryId: "prv-cat-desserts", priceMinor: 11000, allergens: ["dairy", "nuts"], tags: ["new"] },
  { name: "Kulfi", categoryId: "prv-cat-desserts", priceMinor: 8000, allergens: ["dairy", "nuts"], channels: channelsWithout("delivery") },
  {
    name: "Filter coffee",
    categoryId: "prv-cat-drinks",
    priceMinor: 5000,
    allergens: ["dairy"],
    // All day (Q13) for takeaway and dine-in at weekends, with delivery only in the evening.
    schedule: [
      [WEEKDAYS_ONLY, { windows: [["07:00", "11:00"]] }],
      [["sat", "sun"], { allDay: ["takeaway", "dine_in"], windows: [["18:00", "22:00", ["delivery"]]] }],
    ],
  },
  // An overnight window: Friday and Saturday 18:00 until 02:00 the next day.
  { name: "Masala chai", categoryId: "prv-cat-drinks", priceMinor: 4000, allergens: ["dairy"], schedule: [[["fri", "sat"], { windows: [["18:00", "02:00"]] }]] },
  { name: "Sweet lassi", categoryId: "prv-cat-drinks", priceMinor: 9000, allergens: ["dairy"] },
  { name: "Fresh lime soda", categoryId: "prv-cat-drinks", priceMinor: 7000, dietary: "vegan", neverOrdered: true },
  {
    name: "Masala dosa",
    categoryId: "prv-cat-breakfast",
    priceMinor: 14000,
    tags: ["bestseller"],
    schedule: [[["mon", "tue", "wed", "thu", "fri", "sat", "sun"], { windows: [["07:00", "11:00"]] }]],
  },
  { name: "Idli (2 pcs)", categoryId: "prv-cat-breakfast", priceMinor: 8000, dietary: "vegan" },
  { name: "Christmas plum cake", categoryId: "prv-cat-festive", priceMinor: 25000, allergens: ["gluten", "egg", "nuts"], dietary: "egg", archived: true },
  { name: "Mango shake (summer)", categoryId: "prv-cat-drinks", priceMinor: 12000, allergens: ["dairy"], archived: true },
]

const SIZES: Record<string, [string, number][]> = {
  "Veg biryani": [["Half", 14000], ["Full", 22000]],
  "Chicken biryani": [["Half", 18000], ["Full", 28000]],
  "Sweet lassi": [["Regular", 9000], ["Large", 12000]],
}

const GROUPS: Record<string, Omit<OptionGroup, "id" | "options"> & { options: [string, number, boolean?][] }> = {
  "Paneer butter masala": {
    name: "Extras",
    selection: "multiple",
    required: false,
    min: 0,
    max: 2,
    options: [["Extra paneer", 6000], ["Extra gravy", 3000], ["Butter on top", 1500]],
  },
  "Veg biryani": {
    name: "Spice level",
    selection: "single",
    required: true,
    min: 1,
    max: 1,
    options: [["Mild", 0], ["Medium", 0], ["Extra hot", 0, false]],
  },
  "Butter naan": {
    name: "Add-on",
    selection: "single",
    required: false,
    min: 0,
    max: 1,
    options: [["Extra butter", 1000]],
  },
  "Masala chai": {
    name: "Milk",
    selection: "single",
    required: true,
    min: 1,
    max: 1,
    options: [["Regular milk", 0], ["Oat milk", 3000]],
  },
}

export function buildFixtureMenu(now: number): MenuState {
  const categoryName = new Map(CATEGORIES.map((category) => [category.id, category.name]))
  const items: MenuItem[] = ITEMS.map((seed, index) => {
    const id = `prv-item-${String(index + 1).padStart(2, "0")}`
    const sizes: MenuSize[] = (SIZES[seed.name] ?? []).map(([name, priceMinor], sizeIndex) => ({
      id: `${id}-size-${sizeIndex + 1}`,
      name,
      price: money(priceMinor),
      available: true,
    }))
    const group = GROUPS[seed.name]
    const optionGroups: OptionGroup[] = group
      ? [
          {
            ...group,
            id: `${id}-group-1`,
            options: group.options.map(([name, priceMinor, available = true], optionIndex) => ({
              id: `${id}-option-${optionIndex + 1}`,
              name,
              price: money(priceMinor),
              available,
            })),
          },
        ]
      : []
    return {
      id,
      name: seed.name,
      description: "Preview description · illustrative menu item, not a real listing.",
      categoryId: seed.categoryId,
      categoryName: categoryName.get(seed.categoryId) ?? "",
      price: sizes.length ? sizes[0].price : money(seed.priceMinor),
      sizes,
      optionGroups,
      imageUrl: null,
      dietary: seed.dietary ?? "veg",
      allergens: seed.allergens ?? [],
      spiceLevel: seed.spiceLevel ?? "none",
      tags: seed.tags ?? [],
      calories: seed.calories ?? null,
      soldOut: seed.soldOut
        ? {
            until: "next_opening",
            reason: "Out of stock (preview reason)",
            since: new Date(now - 45 * 60_000).toISOString(),
            by: "Preview staff",
          }
        : null,
      channels: seed.channels ?? ALL_CHANNELS,
      schedule: sampleSchedule(seed.schedule, seed.channels ?? ALL_CHANNELS),
      archived: seed.archived ?? false,
      usedOnOrders: !seed.neverOrdered,
    }
  })
  return { items, categories: CATEGORIES.map((category) => ({ ...category })) }
}
