// 12-hour clock display for the time picker. Values are always stored and sent as 24-hour "HH:mm".

export type Period = "AM" | "PM"

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

export type Clock12 = { hour: number; minute: string; period: Period }

/** "18:05" -> { hour: 6, minute: "05", period: "PM" }. Null when `value` is not a valid "HH:mm". */
export function to12Hour(value: string): Clock12 | null {
  const match = HHMM.exec(value)
  if (!match) return null
  const h24 = Number(match[1])
  return { hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: match[2], period: h24 >= 12 ? "PM" : "AM" }
}

/** (6, "05", "PM") -> "18:05". 12 AM is 00:xx and 12 PM is 12:xx. */
export function to24Hour(hour: number, minute: string, period: Period): string {
  const h24 = (hour % 12) + (period === "PM" ? 12 : 0)
  return `${String(h24).padStart(2, "0")}:${minute}`
}

/** "18:00" -> "6:00 PM". Returns the input unchanged when it is not a valid "HH:mm". */
export function format12Hour(value: string): string {
  const clock = to12Hour(value)
  return clock ? `${clock.hour}:${clock.minute} ${clock.period}` : value
}

/**
 * Reads what a person types: "6:30 pm", "6pm", "06:30PM", "12 am", or a 24-hour "18:30".
 * Returns "HH:mm", or null when it is not a real time.
 */
export function parseClockInput(text: string): string | null {
  const input = text.trim().toLowerCase().replace(/\./g, "")
  const match = /^(\d{1,2})(?::([0-5]\d))?\s*(am|pm|a|p)?$/.exec(input)
  if (!match) return null
  const hour = Number(match[1])
  const minute = match[2] ?? "00"
  const marker = match[3]
  if (!marker) {
    // No AM/PM: only an unambiguous 24-hour time with minutes ("18:30") is accepted.
    return match[2] !== undefined && hour <= 23 ? `${String(hour).padStart(2, "0")}:${minute}` : null
  }
  if (hour < 1 || hour > 12) return null
  return to24Hour(hour, minute, marker.startsWith("p") ? "PM" : "AM")
}
