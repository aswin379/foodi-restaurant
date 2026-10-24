import type { Money } from "./types"

// PROVISIONAL: the restaurant's time zone and locale should come from its
// profile once that API exists. Dates and date filters use this zone.
export const RESTAURANT_TIME_ZONE = "Asia/Kolkata"
const LOCALE = "en-IN"

export function formatMoney(money: Money) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: money.currency,
  }).format(money.amountMinor / 100)
}

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: RESTAURANT_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  timeZone: RESTAURANT_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
})

const time = new Intl.DateTimeFormat(LOCALE, {
  timeZone: RESTAURANT_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
})

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

export function formatDate(iso: string) {
  return dateOnly.format(new Date(iso))
}

export function formatTime(iso: string) {
  return time.format(new Date(iso))
}

/** YYYY-MM-DD of an instant in the restaurant's time zone. */
export function localDateKey(iso: string) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}
