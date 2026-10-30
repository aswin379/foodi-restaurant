import type { Allergen, DietaryType, ItemTag, MenuListFilter, SpiceLevel } from "./types"

export const dietaryLabels: Record<DietaryType, string> = {
  veg: "Veg",
  non_veg: "Non-veg",
  egg: "Egg",
  vegan: "Vegan",
}

export const spiceLabels: Record<SpiceLevel, string> = {
  none: "Not spicy",
  mild: "Mild",
  medium: "Medium",
  hot: "Hot",
}

export const tagLabels: Record<ItemTag, string> = {
  bestseller: "Bestseller",
  new: "New",
  chefs_special: "Chef's special",
}

export const allergenLabels: Record<Allergen, string> = {
  gluten: "Gluten",
  dairy: "Dairy",
  egg: "Egg",
  nuts: "Tree nuts",
  peanuts: "Peanuts",
  soy: "Soy",
  sesame: "Sesame",
  mustard: "Mustard",
  fish: "Fish",
  shellfish: "Shellfish",
}

export const listFilterLabels: Record<MenuListFilter, string> = {
  all: "All items",
  available: "Available",
  sold_out: "Sold out",
  archived: "Archived",
}

/** Q11/G5: the panel only explains this; customer apps do the hiding. */
export const HIDDEN_FROM_CUSTOMERS_NOTE = "Hidden from customers while unavailable."
