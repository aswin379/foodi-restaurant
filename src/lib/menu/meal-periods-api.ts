import { ServiceError } from "@/lib/data-source/errors"
import { dayRulesFromApi } from "@/lib/hours/api-mapping"

import type { MealPeriod, MealPeriodStatus, UsageRef } from "./meal-periods"

// Meal periods from the PROPOSED API (docs/meal-periods-ui.md). They hold no
// order types, so nothing here needs the order-type mapping. New in B3b, with
// no older shape: anything unexpected is an integration error, never guessed.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid meal period from API: ${what}`)

function string(value: unknown, what: string): string {
  if (typeof value !== "string" || value === "") throw invalid(what)
  return value
}
const nullableString = (value: unknown, what: string) => (value === null || value === undefined ? null : string(value, what))
const STATUSES: readonly MealPeriodStatus[] = ["active", "archived"]

function usageFromApi(value: unknown, what: string): UsageRef[] {
  if (!Array.isArray(value)) throw invalid(what)
  return value.map((ref) => {
    if (!isRecord(ref) || typeof ref.archived !== "boolean") throw invalid(what)
    return { id: string(ref.id, `${what} id`), name: string(ref.name, `${what} name`), archived: ref.archived }
  })
}

export function mealPeriodFromApi(value: unknown): MealPeriod {
  if (!isRecord(value)) throw invalid("not an object")
  if (typeof value.status !== "string" || !STATUSES.includes(value.status as MealPeriodStatus)) throw invalid("status")
  if (typeof value.usedOnOrders !== "boolean") throw invalid("usedOnOrders")
  if (!isRecord(value.usage)) throw invalid("usage")
  return {
    id: string(value.id, "id"),
    name: string(value.name, "name"),
    status: value.status as MealPeriodStatus,
    weekly: dayRulesFromApi(value.weekly),
    usage: { items: usageFromApi(value.usage.items, "item usage"), categories: usageFromApi(value.usage.categories, "category usage") },
    usedOnOrders: value.usedOnOrders,
    version: string(value.version, "version"),
    updatedAt: nullableString(value.updatedAt, "updatedAt"),
    updatedBy: nullableString(value.updatedBy, "updatedBy"),
  }
}

export function mealPeriodListFromApi(value: unknown): MealPeriod[] {
  if (!Array.isArray(value)) throw invalid("not a list")
  return value.map(mealPeriodFromApi)
}
