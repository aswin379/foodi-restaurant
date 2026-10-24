// Input helpers for local schedule windows ("HH:MM" in the restaurant's
// zone, PRD §3.2): parsing, validation and merging for editors. They don't
// decide whether anything is available at a given moment; that evaluation
// belongs to the server (PRD §9.1).

export type TimeWindow = { start: string; end: string }

export const MINUTES_PER_DAY = 24 * 60
/** PRD §3.2: windows are at least 15 minutes long. */
export const MIN_WINDOW_MINUTES = 15
/** PRD §3.2: the picker uses 15-minute steps (the API accepts any minute). */
export const PICKER_STEP_MINUTES = 15

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Minutes after midnight, or null if not a valid "HH:MM". */
export function parseLocalTime(value: string): number | null {
  const match = TIME_PATTERN.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export function formatLocalTime(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(normalized / 60)
  return `${String(hours).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`
}

/** An end earlier than the start runs past midnight into the next day. */
export function isOvernight(window: TimeWindow): boolean {
  const start = parseLocalTime(window.start)
  const end = parseLocalTime(window.end)
  return start !== null && end !== null && end < start
}

/**
 * Nominal length on the clock face. On a daylight-saving night the real
 * elapsed time differs; the server computes that (PRD §3.2).
 */
export function nominalWindowMinutes(window: TimeWindow): number | null {
  const start = parseLocalTime(window.start)
  const end = parseLocalTime(window.end)
  if (start === null || end === null) return null
  return end >= start ? end - start : end + MINUTES_PER_DAY - start
}

export type WindowProblem = "invalid_time" | "empty" | "too_short"

export function validateWindow(window: TimeWindow): WindowProblem | null {
  const minutes = nominalWindowMinutes(window)
  if (minutes === null) return "invalid_time"
  if (minutes === 0) return "empty"
  if (minutes < MIN_WINDOW_MINUTES) return "too_short"
  return null
}

export const windowProblemMessages: Record<WindowProblem, string> = {
  invalid_time: "Enter times as HH:MM.",
  empty: "Start and end can't be the same time.",
  too_short: `A window must be at least ${MIN_WINDOW_MINUTES} minutes long.`,
}

export type MergedWindows = {
  windows: TimeWindow[]
  /** The windows together cover a full 24 hours from some start time. */
  coversWholeDay: boolean
}

/**
 * Merges overlapping or touching windows of one day, as the editor shows them
 * before saving (PRD §3.2). Overnight windows count from their start day.
 * Invalid windows are ignored; validate first.
 */
export function mergeWindows(windows: TimeWindow[]): MergedWindows {
  const intervals = windows
    .filter((window) => validateWindow(window) === null)
    .map((window) => {
      const start = parseLocalTime(window.start)!
      return [start, start + nominalWindowMinutes(window)!] as const
    })
    .sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const [start, end] of intervals) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }

  // An overnight tail can wrap round and overlap the day's earliest windows.
  while (merged.length > 1) {
    const last = merged.at(-1)!
    const first = merged[0]
    if (last[1] - MINUTES_PER_DAY < first[0]) break
    last[1] = Math.max(last[1], first[1] + MINUTES_PER_DAY)
    merged.shift()
  }

  if (merged.some(([start, end]) => end - start >= MINUTES_PER_DAY)) {
    return { windows: [], coversWholeDay: true }
  }

  return {
    windows: merged.map(([start, end]) => ({
      start: formatLocalTime(start),
      end: formatLocalTime(end),
    })),
    coversWholeDay: false,
  }
}
