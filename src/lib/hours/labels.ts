import { formatCalendarDate } from "@/lib/time/calendar"
import { formatInstant } from "@/lib/time/format"

import type { Actor, ImmediateReason, ImmediateState, PauseDuration, PauseState } from "./types"

// Wording for hours, special dates, pause and status.

export const pauseDurationLabels: Record<PauseDuration, string> = {
  "15m": "15 minutes",
  "30m": "30 minutes",
  "1h": "1 hour",
  rest_of_today: "Rest of today (until midnight)",
  until_resumed: "Until I resume",
}

export const immediateStateLabels: Record<ImmediateState, string> = {
  open: "Open",
  closed: "Closed",
  paused: "Paused",
  unresolved: "Not confirmed",
}

export const immediateReasonLabels: Record<ImmediateReason, string> = {
  weekly_hours: "weekly hours",
  special_date: "special date",
  paused: "restaurant paused",
  no_hours_set: "no hours set",
  all_day: "open all day",
  overnight_into_special_date:
    "an overnight window runs into a special date; how they combine is being confirmed with Foodi",
}

/** "Delivery", "Delivery and Takeaway", "Delivery, Takeaway and Dine-in". */
export function listLabels(labels: readonly string[]) {
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`
}

export const PAUSE_EFFECT_NOTE =
  "Pausing stops new orders for delivery, takeaway and dine-in. Orders already accepted or scheduled aren't changed."

/** Who made a change, for "by …" lines. Automatic changes come from Foodi itself. */
export function actorLabel(actor: Actor | null) {
  if (!actor) return "unknown"
  return actor.kind === "system" ? "Foodi (automatically)" : actor.staff.name
}

/**
 * The server's local resume time for a pause, e.g. "00:00, Sun 25 Oct
 * (Asia/Kolkata)". Taken from the server's `untilLocal`; the browser never
 * works out when a pause ends (P-1).
 */
export function resumeText(pause: Extract<PauseState, { paused: true }>, locale: string) {
  if (pause.until === null) return "until you resume"
  const local = pause.untilLocal
  if (local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) {
    return `until ${local.slice(11, 16)}, ${formatCalendarDate(local.slice(0, 10), locale, "short")} (${pause.timeZone})`
  }
  return `until ${formatInstant(pause.until, { timeZone: pause.timeZone, locale })} (${pause.timeZone})`
}
