// @vitest-environment node
import { describe, expect, it } from "vitest"

import { applyOrderCommand, availableActions, cancellationCheck } from "./lifecycle"
import { testOrder } from "./test-order"
import type { OrderStatus } from "./types"

const now = new Date("2026-10-23T10:05:00.000Z")
const riders = [{ id: "r1", name: "Preview rider A" }]
const foodi = { orderType: "delivery" as const, deliveryMode: "foodi" as const }
const ownRider = { orderType: "delivery" as const, deliveryMode: "restaurant" as const }
const takeaway = { orderType: "takeaway" as const, deliveryMode: null }

describe("availableActions", () => {
  const cases: [OrderStatus, typeof foodi | typeof ownRider | typeof takeaway, string[]][] = [
    ["scheduled", takeaway, []],
    ["pending", takeaway, ["accept", "reject"]],
    ["accepted", foodi, ["mark_ready", "adjust_prep_time", "cancel"]],
    ["ready", foodi, ["cancel"]],
    ["ready", ownRider, ["dispatch", "cancel"]],
    ["ready", takeaway, ["complete", "cancel"]],
    ["out_for_delivery", ownRider, ["complete", "cancel"]],
    ["out_for_delivery", foodi, []],
    ["completed", takeaway, []],
    ["rejected", takeaway, []],
    ["cancelled", takeaway, []],
  ]
  it.each(cases)("%s / %o → %o", (status, channel, expected) => {
    expect(availableActions({ status, ...channel })).toEqual(expected)
  })

  it("never offers a separate Start preparing action (Q10)", () => {
    for (const status of ["pending", "accepted", "ready"] as const) {
      expect(availableActions({ status, ...takeaway })).not.toContain("start_preparing")
    }
  })
})

describe("cancellationCheck (PRD §4.3)", () => {
  it("allows accepted and ready orders", () => {
    expect(cancellationCheck({ status: "accepted", ...takeaway })).toEqual({ allowed: true, needsRiderConfirmation: false })
    expect(cancellationCheck({ status: "ready", ...foodi })).toEqual({ allowed: true, needsRiderConfirmation: false })
  })

  it("needs rider confirmation for an own-rider order out for delivery", () => {
    expect(cancellationCheck({ status: "out_for_delivery", ...ownRider })).toEqual({
      allowed: true,
      needsRiderConfirmation: true,
    })
  })

  it("sends Foodi-rider orders to support, and new orders to Reject", () => {
    expect(cancellationCheck({ status: "out_for_delivery", ...foodi })).toEqual({ allowed: false, reason: "foodi_rider" })
    expect(cancellationCheck({ status: "pending", ...takeaway })).toEqual({ allowed: false, reason: "use_reject" })
    expect(cancellationCheck({ status: "completed", ...takeaway })).toEqual({ allowed: false, reason: "closed" })
  })
})

describe("applyOrderCommand", () => {
  it("accept sets preparationStartedAt to the server's time and computes ready-by (Q10)", () => {
    const accepted = applyOrderCommand(testOrder(), { type: "accept", prepTimeMinutes: 20 }, { now })
    expect(accepted).toMatchObject({
      status: "accepted",
      preparationStartedAt: "2026-10-23T10:05:00.000Z",
      prepTimeMinutes: 20,
      readyBy: "2026-10-23T10:25:00.000Z",
    })
    expect(accepted.timeline.at(-1)).toMatchObject({ type: "accepted", actor: "restaurant", detail: "Prep time 20 min" })
  })

  it("reject records the reason and starts a pending refund for a paid online order", () => {
    const rejected = applyOrderCommand(testOrder(), { type: "reject", reason: "too_busy", note: "" }, { now })
    expect(rejected.status).toBe("rejected")
    expect(rejected.paymentStatus).toBe("refund_pending")
    expect(rejected.closure).toEqual({ actor: "restaurant", reason: "Too busy", note: null, at: now.toISOString() })
  })

  it("never marks a refund as completed", () => {
    const accepted = testOrder({ status: "accepted", preparationStartedAt: now.toISOString() })
    const cancelled = applyOrderCommand(
      accepted,
      { type: "cancel", reason: "kitchen_issue", note: "Oven down", riderRecallConfirmed: false },
      { now }
    )
    expect(cancelled.paymentStatus).toBe("refund_pending")
    expect(cancelled.timeline.at(-1)).toMatchObject({ type: "cancelled", reason: "Kitchen issue", note: "Oven down", detail: "Stock not returned" })
  })

  it("leaves an unpaid cash order unpaid when it's rejected", () => {
    const cash = testOrder({ paymentMethod: "cash", paymentStatus: "unpaid" })
    expect(applyOrderCommand(cash, { type: "reject", reason: "too_busy", note: "" }, { now }).paymentStatus).toBe("unpaid")
  })

  it("refuses a command that doesn't fit the current status", () => {
    const conflict = expect.objectContaining({ kind: "conflict" })
    expect(() => applyOrderCommand(testOrder(), { type: "mark_ready" }, { now })).toThrow(conflict)
    expect(() =>
      applyOrderCommand(testOrder({ status: "completed" }), { type: "accept", prepTimeMinutes: 10 }, { now })
    ).toThrow(conflict)
    expect(() =>
      applyOrderCommand(testOrder(), { type: "cancel", reason: "other", note: "x", riderRecallConfirmed: false }, { now })
    ).toThrow(conflict)
  })

  it("refuses to cancel a Foodi rider's order", () => {
    const order = testOrder({ status: "out_for_delivery", ...foodi })
    expect(() =>
      applyOrderCommand(order, { type: "cancel", reason: "kitchen_issue", note: "", riderRecallConfirmed: true }, { now })
    ).toThrow(expect.objectContaining({ kind: "conflict" }))
  })

  it("requires rider confirmation to cancel an own-rider order out for delivery", () => {
    const order = testOrder({ status: "out_for_delivery", ...ownRider, rider: riders[0] })
    expect(() =>
      applyOrderCommand(order, { type: "cancel", reason: "kitchen_issue", note: "", riderRecallConfirmed: false }, { now })
    ).toThrow(expect.objectContaining({ kind: "validation" }))
    expect(
      applyOrderCommand(order, { type: "cancel", reason: "kitchen_issue", note: "", riderRecallConfirmed: true }, { now }).status
    ).toBe("cancelled")
  })

  it("adjusts prep time from the original start", () => {
    const order = testOrder({
      status: "accepted",
      preparationStartedAt: "2026-10-23T10:00:00.000Z",
      prepTimeMinutes: 20,
      readyBy: "2026-10-23T10:20:00.000Z",
    })
    expect(applyOrderCommand(order, { type: "adjust_prep_time", addMinutes: 10 }, { now })).toMatchObject({
      prepTimeMinutes: 30,
      readyBy: "2026-10-23T10:30:00.000Z",
    })
  })

  it("dispatches own-rider orders to a known rider only", () => {
    const order = testOrder({ status: "ready", ...ownRider })
    expect(() => applyOrderCommand(order, { type: "dispatch", riderId: "nobody" }, { now, riders })).toThrow(
      expect.objectContaining({ kind: "validation" })
    )
    expect(applyOrderCommand(order, { type: "dispatch", riderId: "r1" }, { now, riders })).toMatchObject({
      status: "out_for_delivery",
      rider: riders[0],
    })
    expect(() =>
      applyOrderCommand(testOrder({ status: "ready", ...foodi }), { type: "dispatch", riderId: "r1" }, { now, riders })
    ).toThrow(expect.objectContaining({ kind: "conflict" }))
  })

  it("collects cash on completion", () => {
    const order = testOrder({ status: "ready", paymentMethod: "cash", paymentStatus: "unpaid" })
    expect(applyOrderCommand(order, { type: "complete" }, { now })).toMatchObject({ status: "completed", paymentStatus: "paid" })
  })

  it("doesn't change the order it was given", () => {
    const order = testOrder()
    const copy = structuredClone(order)
    applyOrderCommand(order, { type: "accept", prepTimeMinutes: 15 }, { now })
    expect(order).toEqual(copy)
  })
})
