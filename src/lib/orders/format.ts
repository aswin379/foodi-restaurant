import { formatInstant, type ZoneAndLocale } from "@/lib/time/format"

import type { Money } from "./types"

// Orders format dates in the restaurant's own time zone and locale, which
// come from the orders data source's restaurant context.

export type { ZoneAndLocale }

/** The default locale is kept for the Menu module until B2 moves it over. */
export function formatMoney(money: Money, locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  }).format(money.amountMinor / 100)
}

export const formatDateTime = (iso: string, context: ZoneAndLocale) =>
  formatInstant(iso, context, "dateTime")

export const formatDate = (iso: string, context: ZoneAndLocale) =>
  formatInstant(iso, context, "date")

export const formatTime = (iso: string, context: ZoneAndLocale) =>
  formatInstant(iso, context, "time")
