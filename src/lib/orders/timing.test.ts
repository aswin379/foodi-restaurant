// @vitest-environment node
import { describe, expect, it } from "vitest"

import { describeTiming, formatDuration, orderTiming } from "./timing"

const now = Date.parse("2026-10-23T12:00:00.000Z")
const base = { placedAt: "2026-10-23T11:58:00.000Z", readyBy: null, scheduledFor: null }

describe("orderTiming", () => {
  it("counts how long a new order has waited, and flags it after 5 minutes", () => {
    expect(orderTiming({ ...base, status: "pending" }, now)).toEqual({ kind: "waiting", minutes: 2, needsAttention: false })
    expect(orderTiming({ ...base, status: "pending", placedAt: "2026-10-23T11:54:00.000Z" }, now)).toMatchObject({
      needsAttention: true,
    })
  })

  it("shows time left, then lateness, for accepted orders", () => {
    expect(orderTiming({ ...base, status: "accepted", readyBy: "2026-10-23T12:12:30.000Z" }, now)).toEqual({
      kind: "preparing",
      minutesLeft: 13,
    })
    expect(orderTiming({ ...base, status: "accepted", readyBy: "2026-10-23T11:57:00.000Z" }, now)).toEqual({
      kind: "late",
      minutesLate: 3,
    })
  })

  it("counts down to a scheduled slot", () => {
    expect(orderTiming({ ...base, status: "scheduled", scheduledFor: "2026-10-23T13:30:00.000Z" }, now)).toEqual({
      kind: "starts_in",
      minutes: 90,
    })
  })

  it("has no timer for other statuses", () => {
    expect(orderTiming({ ...base, status: "completed" }, now)).toEqual({ kind: "none" })
  })
})

describe("describeTiming", () => {
  it("writes short labels", () => {
    expect(describeTiming({ kind: "waiting", minutes: 0, needsAttention: false })).toBe("Just now")
    expect(describeTiming({ kind: "preparing", minutesLeft: 13 })).toBe("13 min left")
    expect(describeTiming({ kind: "late", minutesLate: 75 })).toBe("Late by 1 h 15 min")
    expect(describeTiming({ kind: "starts_in", minutes: 120 })).toBe("Slot in 2 h")
    expect(describeTiming({ kind: "none" })).toBeNull()
    expect(formatDuration(59)).toBe("59 min")
  })
})
