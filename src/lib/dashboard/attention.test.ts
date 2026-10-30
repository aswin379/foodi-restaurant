// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { PauseState } from "@/lib/hours/types"
import type { OrderDetail, OrderItem } from "@/lib/orders/types"

import { attentionItems, type AttentionInput } from "./attention"

const nowMs = Date.parse("2026-10-28T06:00:00.000Z")
const minutesAgo = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString()

type BoardOrder = NonNullable<AttentionInput["board"]>[number]
const line = (unavailable = false): OrderItem =>
  ({ id: "l", name: "Dish", unavailableAfterPlacement: unavailable ? { at: minutesAgo(1), by: "Staff" } : null }) as OrderItem
const order = (id: string, overrides: Partial<OrderDetail> = {}): BoardOrder => ({
  id,
  reference: id.toUpperCase(),
  status: "pending",
  placedAt: minutesAgo(1),
  readyBy: null,
  scheduledFor: null,
  items: [line()],
  ...overrides,
})
const none: AttentionInput = { pause: null, board: [], soldOut: { count: 0, names: [] }, nowMs }

describe("attentionItems", () => {
  it("is empty when nothing needs attention", () => {
    expect(attentionItems(none)).toEqual([])
  })

  it("flags a pause, with its reason, linking to hours", () => {
    const [item] = attentionItems({ ...none, pause: { paused: true, until: null, reason: "Kitchen deep clean" } as unknown as PauseState })
    expect(item).toMatchObject({ id: "paused", description: "Reason: Kitchen deep clean", href: "/hours" })
  })

  it("flags new orders waiting 5 minutes or more using the Orders timing rule", () => {
    const items = attentionItems({
      ...none,
      board: [order("a", { placedAt: minutesAgo(4) }), order("b", { placedAt: minutesAgo(5) }), order("c", { placedAt: minutesAgo(9) })],
    })
    expect(items).toEqual([
      expect.objectContaining({ id: "waiting", title: "2 new orders waiting 5 minutes or more", description: "B, C", href: "/orders#board-new" }),
    ])
  })

  it("flags late orders, listing up to three references", () => {
    const late = ["a", "b", "c", "d"].map((id) => order(id, { status: "accepted", readyBy: minutesAgo(2) }))
    const items = attentionItems({ ...none, board: [...late, order("e", { status: "accepted", readyBy: minutesAgo(-10) })] })
    expect(items).toEqual([
      expect.objectContaining({ id: "late", title: "4 orders past the ready time", description: "A, B, C and 1 more", href: "/orders#board-kitchen" }),
    ])
  })

  it("flags only orders with lines the server marked unavailable, linking to the one order", () => {
    const items = attentionItems({ ...none, board: [order("x", { status: "accepted", items: [line(), line(true)] }), order("y")] })
    expect(items).toEqual([expect.objectContaining({ id: "unavailable_lines", href: "/orders/x", linkLabel: "Open order X" })])
    const several = attentionItems({ ...none, board: [order("x", { items: [line(true)] }), order("y", { items: [line(true)] })] })
    expect(several[0]).toMatchObject({ id: "unavailable_lines", href: "/orders" })
  })

  it("flags sold-out items with the total from the menu, not just the names shown", () => {
    const [item] = attentionItems({ ...none, soldOut: { count: 5, names: ["Dosa", "Idli", "Vada"] } })
    expect(item).toMatchObject({ id: "sold_out", title: "5 menu items are sold out", description: "Dosa, Idli, Vada and 2 more", href: "/menu?filter=sold_out" })
  })

  it("raises nothing for a source that couldn't be read, and never repeats an alert", () => {
    expect(attentionItems({ pause: null, board: null, soldOut: null, nowMs })).toEqual([])
    const ids = attentionItems({
      ...none,
      board: [order("a", { placedAt: minutesAgo(10), items: [line(true)] }), order("b", { placedAt: minutesAgo(10) })],
    }).map((item) => item.id)
    expect(ids).toEqual(["waiting", "unavailable_lines"])
  })
})
