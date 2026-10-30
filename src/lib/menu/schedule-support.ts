import "server-only"

import { isServiceError } from "@/lib/data-source/errors"
import { getWeeklyHours, hoursMode } from "@/lib/hours/service"

import type { HoursForCheck } from "./hours-warnings"
import type { MealPeriod } from "./meal-periods"
import { getMenuContext, listMealPeriods, menuMode } from "./service"

/**
 * What the item and category editors need beyond the menu itself (B3b):
 * meal periods to choose from, and restaurant hours for the advisory check.
 * Both are optional: a failure is passed on as "couldn't load", never
 * replaced with other data. Hours are only used when they come from the same
 * data source as the menu, so preview hours are never compared with a real
 * menu (or the other way round).
 */
export async function loadScheduleSupport(): Promise<{ mealPeriods: MealPeriod[] | null; hours: HoursForCheck }> {
  const [mealPeriods, hours] = await Promise.all([
    listMealPeriods().catch(() => null),
    loadHours(),
  ])
  return { mealPeriods, hours }
}

async function loadHours(): Promise<HoursForCheck> {
  if (hoursMode() !== menuMode()) {
    return { kind: "unavailable", reason: "Menu and restaurant hours come from different data sources, so they aren't compared." }
  }
  try {
    const hours = await getWeeklyHours()
    return { kind: "loaded", timeZone: hours.timeZone, byOrderType: hours.byOrderType }
  } catch (error) {
    return {
      kind: "unavailable",
      reason:
        isServiceError(error) && error.kind === "not_configured"
          ? "Restaurant hours aren't connected yet."
          : "Restaurant hours couldn't be loaded.",
    }
  }
}

/** For the category dialog: the restaurant's zone and meal periods, or null if the zone couldn't be loaded. */
export async function loadCategoryScheduleSupport(): Promise<{ timeZone: string; mealPeriods: MealPeriod[] | null } | null> {
  try {
    const [context, mealPeriods] = await Promise.all([getMenuContext(), listMealPeriods().catch(() => null)])
    return { timeZone: context.timeZone, mealPeriods }
  } catch {
    return null
  }
}
