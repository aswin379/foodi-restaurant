// Display helpers for instants (UTC timestamps from the server). Always in the
// restaurant's IANA time zone, never the device's (PRD §3.2); the zone's own
// rules decide the offset for each date, so daylight-saving changes are
// handled by Intl rather than a fixed offset.

export type ZoneAndLocale = {
  timeZone: string
  locale: string
}

export type InstantStyle = "dateTime" | "date" | "time"

const STYLE_OPTIONS: Record<InstantStyle, Intl.DateTimeFormatOptions> = {
  dateTime: { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  date: { day: "numeric", month: "short", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
}

export function formatInstant(
  iso: string,
  context: ZoneAndLocale,
  style: InstantStyle = "dateTime"
): string {
  return new Intl.DateTimeFormat(context.locale, {
    ...STYLE_OPTIONS[style],
    timeZone: context.timeZone,
  }).format(new Date(iso))
}

/** The calendar date (YYYY-MM-DD) of an instant in the restaurant's zone. */
export function localDateOf(iso: string, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

/** True if the runtime knows this IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone })
    return true
  } catch {
    return false
  }
}
