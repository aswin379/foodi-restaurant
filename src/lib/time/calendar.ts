import { WEEKDAYS, type Weekday } from "./weekly"

// Calendar dates (YYYY-MM-DD) in a restaurant's IANA zone. Used for display
// and by the preview data source. Authoritative instants (pause expiry,
// availability) come from the server; nothing here replaces that.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(date: string) {
  const match = DATE_PATTERN.exec(date)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
    ? { year, month, day, utc }
    : null
}

export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && parts(value) !== null
}

export function addDays(date: string, days: number): string {
  const { utc } = parts(date)!
  return new Date(utc.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

export function weekdayOf(date: string): Weekday {
  // getUTCDay: 0 = Sunday.
  return WEEKDAYS[(parts(date)!.utc.getUTCDay() + 6) % 7]
}

/** "Sun 8 Nov 2026" for a calendar date (no zone involved). */
export function formatCalendarDate(date: string, locale = "en-IN", style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(style === "long" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(parts(date)!.utc)
}

/** Local calendar date, weekday and minutes after midnight of an instant in `timeZone`. */
export function localClock(instant: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value])
  )
  const date = `${values.year}-${values.month}-${values.day}`
  return { date, weekday: weekdayOf(date), minutes: Number(values.hour) * 60 + Number(values.minute) }
}

/** The zone's offset from UTC, in minutes, at an instant. */
export function offsetMinutes(instant: number, timeZone: string): number {
  const { date, minutes } = localClock(new Date(instant), timeZone)
  const seconds = new Date(instant).getUTCSeconds()
  const localAsUtc = parts(date)!.utc.getTime() + minutes * 60_000 + seconds * 1000
  return Math.round((localAsUtc - (instant - (instant % 1000))) / 60_000)
}

/**
 * The instant local midnight starts `date` in `timeZone`. If midnight doesn't
 * exist (a daylight-saving gap), the first valid instant of the day.
 */
export function startOfLocalDay(date: string, timeZone: string): Date {
  const guess = parts(date)!.utc.getTime()
  const candidates = [guess - offsetMinutes(guess, timeZone) * 60_000]
  candidates.push(guess - offsetMinutes(candidates[0], timeZone) * 60_000)
  const onDate = candidates.filter((candidate) => localClock(new Date(candidate), timeZone).date === date).sort((a, b) => a - b)
  if (onDate.length) return new Date(onDate[0])
  // Midnight falls in a gap: step forward to the first minute that's on `date`.
  let instant = Math.min(...candidates)
  while (localClock(new Date(instant), timeZone).date !== date) instant += 60_000
  return new Date(instant)
}

/** Length of a local calendar day in hours: 24, or 23/25 on a daylight-saving change. */
export function localDayHours(date: string, timeZone: string): number {
  const start = startOfLocalDay(date, timeZone).getTime()
  const end = startOfLocalDay(addDays(date, 1), timeZone).getTime()
  return Math.round(((end - start) / 3_600_000) * 100) / 100
}
