// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { createPreviewOrdersAdapter, resetPreviewOrders, simulateIncomingPreviewOrder } from "./preview-source"
import { parseOrderListQuery } from "./query"
import { ACTIVE_ORDER_STATUSES } from "./types"

const KEY_A = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const KEY_B = "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

describe("preview orders adapter", () => {
  it("covers every board state in the sample data", async () => {
    const board = await createPreviewOrdersAdapter().board()
    const statuses = new Set(board.map((order) => order.status))
    for (const status of ACTIVE_ORDER_STATUSES) expect(statuses.has(status)).toBe(true)
    expect(board.some((order) => order.unavailableLineCount > 0)).toBe(true)
    expect(board.some((order) => order.status === "ready" && order.deliveryMode === "restaurant")).toBe(true)
  })

  it("orders the board by column, oldest new order first", async () => {
    const board = await createPreviewOrdersAdapter().board()
    const pending = board.filter((order) => order.status === "pending")
    expect(pending.map((order) => order.placedAt)).toEqual([...pending.map((order) => order.placedAt)].sort())
    expect(board[0].status).toBe("scheduled")
  })

  it("applies a repeated idempotency key only once", async () => {
    const adapter = createPreviewOrdersAdapter()
    const first = await adapter.act("prv-1004", { type: "accept", prepTimeMinutes: 20 }, KEY_A)
    const replay = await adapter.act("prv-1004", { type: "accept", prepTimeMinutes: 20 }, KEY_A)
    expect(replay).toEqual(first)
    const timeline = (await adapter.get("prv-1004"))!.timeline
    expect(timeline.filter((event) => event.type === "accepted")).toHaveLength(1)

    // A new key is a new attempt, which the lifecycle now refuses.
    await expect(adapter.act("prv-1004", { type: "accept", prepTimeMinutes: 20 }, KEY_B)).rejects.toMatchObject({
      kind: "conflict",
    })
  })

  it("refuses a key reused for a different order", async () => {
    const adapter = createPreviewOrdersAdapter()
    await adapter.act("prv-1004", { type: "accept", prepTimeMinutes: 20 }, KEY_A)
    await expect(adapter.act("prv-1005", { type: "accept", prepTimeMinutes: 20 }, KEY_A)).rejects.toMatchObject({
      kind: "conflict",
    })
  })

  it("filters history by status and reference", async () => {
    const adapter = createPreviewOrdersAdapter()
    const pending = await adapter.list(parseOrderListQuery({ status: "pending" }))
    expect(pending.items.every((order) => order.status === "pending")).toBe(true)
    const found = await adapter.list(parseOrderListQuery({ q: "prv-1010" }))
    expect(found.items.map((order) => order.reference)).toEqual(["PRV-1010"])
  })

  it("simulates incoming orders and resets them", async () => {
    const order = simulateIncomingPreviewOrder()
    expect(order).toMatchObject({ status: "pending", reference: "PRV-2001" })
    expect(simulateIncomingPreviewOrder().reference).toBe("PRV-2002")
    resetPreviewOrders()
    expect(await createPreviewOrdersAdapter().get(order.id)).toBeNull()
  })

  it("shows preview scenarios", async () => {
    const adapter = createPreviewOrdersAdapter()
    await expect(adapter.board("empty")).resolves.toEqual([])
    await expect(adapter.board("error")).rejects.toMatchObject({ kind: "unavailable" })
  })

  it("refuses to run in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    await expect(createPreviewOrdersAdapter().board()).rejects.toMatchObject({ kind: "forbidden" })
    expect(() => simulateIncomingPreviewOrder()).toThrow(expect.objectContaining({ kind: "forbidden" }))
  })
})
