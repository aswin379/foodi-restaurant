// @vitest-environment node
import { describe, expect, it } from "vitest"

import { daySummaryFromApi } from "./api-mapping"
import { countOrdersPlacedOn, totalOrders } from "./summary"
import { ORDER_STATUSES } from "./types"

const zone = "Asia/Kolkata" // UTC+5:30

describe("countOrdersPlacedOn", () => {
  it("counts by the restaurant-local placement date, across the UTC day boundary", () => {
    const counts = countOrdersPlacedOn(
      [
        // 28 Oct 00:10 in Kolkata is still 27 Oct in UTC.
        { placedAt: "2026-10-27T18:40:00.000Z", status: "completed" },
        // 27 Oct 23:50 in Kolkata: the day before.
        { placedAt: "2026-10-27T18:20:00.000Z", status: "completed" },
        { placedAt: "2026-10-28T10:00:00.000Z", status: "pending" },
      ],
      "2026-10-28",
      zone
    )
    expect(counts.completed).toBe(1)
    expect(counts.pending).toBe(1)
    expect(totalOrders(counts)).toBe(2)
  })

  it("leaves out an order scheduled for today but placed earlier, and counts it on its placement day", () => {
    const order = { placedAt: "2026-10-27T09:00:00.000Z", status: "scheduled" as const }
    expect(totalOrders(countOrdersPlacedOn([order], "2026-10-28", zone))).toBe(0)
    expect(countOrdersPlacedOn([order], "2026-10-27", zone).scheduled).toBe(1)
  })

  it("counts rejected and cancelled orders (payment failures included), with every status present", () => {
    const counts = countOrdersPlacedOn(
      [
        { placedAt: "2026-10-28T05:00:00.000Z", status: "rejected" },
        { placedAt: "2026-10-28T05:00:00.000Z", status: "cancelled" },
      ],
      "2026-10-28",
      zone
    )
    expect(Object.keys(counts).sort()).toEqual([...ORDER_STATUSES].sort())
    expect(counts).toMatchObject({ rejected: 1, cancelled: 1, completed: 0 })
  })
})

describe("daySummaryFromApi", () => {
  const expected = { date: "2026-10-28", timeZone: zone }
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]))
  const valid = { date: "2026-10-28", timeZone: zone, countsByStatus: { ...counts, pending: 2 }, asOf: "2026-10-28T06:00:00Z" }

  it("accepts a complete summary for the requested date and zone, as server data", () => {
    expect(daySummaryFromApi({ ...valid, source: "preview_estimate" }, expected)).toEqual({
      ...valid,
      source: "server",
    })
  })

  it.each([
    ["not an object", null],
    ["another date", { ...valid, date: "2026-10-27" }],
    ["another zone", { ...valid, timeZone: "UTC" }],
    ["a bad asOf", { ...valid, asOf: "soon" }],
    ["no counts", { ...valid, countsByStatus: [] }],
    ["an unknown status", { ...valid, countsByStatus: { ...counts, on_hold: 1 } }],
    ["a missing status", { ...valid, countsByStatus: { ...counts, cancelled: undefined } }],
    ["a negative count", { ...valid, countsByStatus: { ...counts, pending: -1 } }],
    ["a fractional count", { ...valid, countsByStatus: { ...counts, pending: 1.5 } }],
    ["a count as text", { ...valid, countsByStatus: { ...counts, pending: "2" } }],
  ])("refuses %s, never guessing a figure", (_, value) => {
    expect(() => daySummaryFromApi(value, expected)).toThrow(expect.objectContaining({ kind: "unavailable" }))
  })
})
