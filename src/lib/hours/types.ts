import type { OrderType } from "@/lib/domain/order-types"
import type { Weekday } from "@/lib/time/weekly"
import type { TimeWindow } from "@/lib/time/windows"

// Restaurant hours, special dates and pause (PRD v0.3 §3.3, decisions H2–H9,
// P-1, P-2). This is the frontend's working model for the PROPOSED contract
// in docs/hours-ui.md, not a confirmed backend contract.

export type StaffRef = { id: string; name: string }
/** Who made a change. "system" is an automatic change, such as a pause expiring. */
export type Actor = { kind: "staff"; staff: StaffRef } | { kind: "system" }

/** Hours for a group of days of one order type (H2: All day is separate from windows). */
export type DayRule = {
  days: Weekday[]
  /** The whole local calendar day, midnight to midnight. */
  allDay: boolean
  /** End before start = overnight, owned by the start day (PRD §3.2). */
  windows: TimeWindow[]
}

export type WeeklyHours = {
  /** The restaurant's IANA zone. Read-only here; set in restaurant settings. */
  timeZone: string
  /** A weekday with no rule for an order type is closed for it. */
  byOrderType: Record<OrderType, DayRule[]>
  /** PROPOSED optimistic-concurrency token. */
  version: string
  updatedAt: string | null
  updatedBy: Actor | null
}

export const SPECIAL_DATE_KINDS = ["closed", "special_hours"] as const
export type SpecialDateKind = (typeof SPECIAL_DATE_KINDS)[number]

/** H3: one calendar date, for the listed order types only. */
export type SpecialDate = {
  id: string
  /** Restaurant-local calendar date, YYYY-MM-DD. */
  date: string
  orderTypes: OrderType[]
  kind: SpecialDateKind
  /** special_hours only. */
  allDay: boolean
  /** special_hours only; overnight allowed. */
  windows: TimeWindow[]
  note: string | null
  /** Set by the server: false once the date has passed. */
  editable: boolean
  version: string
  createdAt: string
  createdBy: Actor
  updatedAt: string
  updatedBy: Actor
}

export const PAUSE_DURATIONS = ["15m", "30m", "1h", "rest_of_today", "until_resumed"] as const
export type PauseDuration = (typeof PAUSE_DURATIONS)[number]

/** H5: restaurant-wide. Stops new immediate orders; never changes existing orders. */
export type PauseState =
  | { paused: false; lastResumedAt: string | null; lastResumedBy: Actor | null }
  | {
      paused: true
      duration: PauseDuration
      since: string
      /** UTC instant calculated by the server; null = until resumed. */
      until: string | null
      /** The same instant as local wall time, from the server (P-1). */
      untilLocal: string | null
      timeZone: string
      reason: string | null
      by: Actor
    }

export type ImmediateState = "open" | "closed" | "paused" | "unresolved"

export type ImmediateReason =
  | "weekly_hours"
  | "special_date"
  | "paused"
  | "no_hours_set"
  | "all_day"
  /** Preview estimate only: an overnight window runs into a special date (H4, unconfirmed). */
  | "overnight_into_special_date"

export type OrderTypeStatus = {
  immediate: {
    state: ImmediateState
    reason: ImmediateReason
    until: string | null
    nextOpening: string | null
  }
  /**
   * P-2: whether new scheduled orders are accepted (each still validated by
   * the backend). Null when the backend doesn't report it; the UI then makes
   * no claim about scheduled orders.
   */
  scheduled: { accepting: boolean } | null
}

export type AvailabilityStatus = {
  asOf: string
  timeZone: string
  /** "preview_estimate" only in preview mode; never live availability. */
  source: "server" | "preview_estimate"
  pause: PauseState
  byOrderType: Record<OrderType, OrderTypeStatus>
}
