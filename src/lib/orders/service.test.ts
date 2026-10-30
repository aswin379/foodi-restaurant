// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { parseOrderListQuery } from "./query"
import {
  getOrder,
  getOrderBoard,
  getOrdersContext,
  listOrders,
  ordersMode,
  performOrderCommand,
  resetOrdersPreview,
  simulateIncomingOrder,
} from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const query = parseOrderListQuery({})
const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const notConfigured = expect.objectContaining({ kind: "not_configured" })

beforeEach(() => {
  vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

describe("orders data source", () => {
  it("refuses preview data in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview"]) {
      vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", value)
      expect(ordersMode()).toBe("api")
      await expect(listOrders(query)).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getOrderBoard()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getOrder("prv-1003")).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getOrdersContext()).rejects.toMatchObject({ kind: "not_configured" })
    }
  })

  it("never applies a command against preview data in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "preview")
    await expect(performOrderCommand("prv-1003", { type: "accept", prepTimeMinutes: 20 }, KEY)).rejects.toEqual(
      notConfigured
    )
    await expect(simulateIncomingOrder()).rejects.toMatchObject({ kind: "forbidden" })
    await expect(resetOrdersPreview()).rejects.toMatchObject({ kind: "forbidden" })
  })

  it("doesn't fall back to preview data when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(listOrders(query)).rejects.toMatchObject({ kind: "not_configured" })
    await expect(getOrderBoard()).rejects.toMatchObject({ kind: "not_configured" })
    await expect(simulateIncomingOrder()).rejects.toMatchObject({ kind: "forbidden" })
  })

  it("serves labelled PRV- sample orders when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "preview")
    const result = await listOrders(query)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((order) => order.reference.startsWith("PRV-"))).toBe(true)
    await expect(getOrdersContext()).resolves.toMatchObject({ timeZone: "Asia/Kolkata" })
  })

  it("keeps simulated changes for later reads, until reset", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "preview")
    const accepted = await performOrderCommand("prv-1003", { type: "accept", prepTimeMinutes: 15 }, KEY)
    expect(accepted.status).toBe("accepted")
    expect((await getOrder("prv-1003"))?.status).toBe("accepted")

    await resetOrdersPreview()
    expect((await getOrder("prv-1003"))?.status).toBe("pending")
  })
})
