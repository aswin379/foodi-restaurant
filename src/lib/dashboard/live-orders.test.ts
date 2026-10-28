// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { OrderStatus } from "@/lib/orders/types"

import { countLiveOrders, LIVE_STATUSES } from "./live-orders"

const orders = (...statuses: string[]) => statuses.map((status) => ({ status: status as OrderStatus }))

describe("countLiveOrders", () => {
  it("counts each active status, with zeros for the rest", () => {
    expect(countLiveOrders(orders("pending", "pending", "accepted", "out_for_delivery"))).toEqual({
      scheduled: 0,
      pending: 2,
      accepted: 1,
      ready: 0,
      out_for_delivery: 1,
    })
  })

  it("fails visibly on an unknown or closed status instead of hiding it", () => {
    expect(() => countLiveOrders(orders("pending", "on_hold"))).toThrow(expect.objectContaining({ kind: "unavailable" }))
    expect(() => countLiveOrders(orders("completed"))).toThrow(expect.objectContaining({ kind: "unavailable" }))
  })

  it("links each status to a board column that exists", () => {
    expect(LIVE_STATUSES.map(({ label, anchor }) => [label, anchor])).toEqual([
      ["New", "board-new"],
      ["In kitchen", "board-kitchen"],
      ["Ready", "board-ready"],
      ["Out for delivery", "board-ready"],
      ["Scheduled", "board-scheduled"],
    ])
  })
})
