import { ServiceError } from "@/lib/data-source/errors"

import type { OrdersDaySummary } from "./summary"
import { ORDER_STATUSES, type OrderStatus } from "./types"

// Response parsing for the PROPOSED orders summary contract
// (docs/dashboard-ui.md). Order statuses are read as the canonical names
// (PRD §4.1); the backend's names aren't decided, and an unknown, missing or
// malformed value is an integration error, never guessed or turned into 0.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid orders summary from API: ${what}`)
const isOrderStatus = (value: string): value is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(value)

/**
 * A day summary from the API. It must be for the date and zone that were
 * asked for, so figures from another day or zone are never shown as today's.
 */
export function daySummaryFromApi(value: unknown, expected: { date: string; timeZone: string }): OrdersDaySummary {
  if (!isRecord(value)) throw invalid("not an object")
  if (value.date !== expected.date) throw invalid("date doesn't match the requested date")
  if (value.timeZone !== expected.timeZone) throw invalid("timeZone doesn't match the restaurant's")
  if (typeof value.asOf !== "string" || Number.isNaN(Date.parse(value.asOf))) throw invalid("asOf")
  if (!isRecord(value.countsByStatus)) throw invalid("countsByStatus")
  const counts: Partial<Record<OrderStatus, number>> = {}
  for (const [status, count] of Object.entries(value.countsByStatus)) {
    if (!isOrderStatus(status)) throw invalid(`unknown status ${status}`)
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) throw invalid(`count for ${status}`)
    counts[status] = count
  }
  const missing = ORDER_STATUSES.filter((status) => counts[status] === undefined)
  if (missing.length) throw invalid(`missing statuses ${missing.join(", ")}`)
  return {
    date: expected.date,
    timeZone: expected.timeZone,
    countsByStatus: counts as Record<OrderStatus, number>,
    asOf: value.asOf,
    // Whatever the response says, API data is the server's.
    source: "server",
  }
}
