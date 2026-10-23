// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { parseOrderListQuery } from "./query"
import { getOrder, listOrders, ordersDataSource } from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const query = parseOrderListQuery({})

describe("orders data source (existing RUI-02 behaviour)", () => {
  beforeEach(() => {
    vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "")
  })

  it("refuses fixtures in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "fixtures")
    expect(ordersDataSource()).toBe("api")
    await expect(listOrders(query)).rejects.toMatchObject({ kind: "not_configured" })
    await expect(getOrder("anything")).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("doesn't fall back to fixtures when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(listOrders(query)).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("serves labelled PRV- sample orders only when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_ORDERS_DATA_SOURCE", "fixtures")
    const result = await listOrders(query)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((order) => order.reference.startsWith("PRV-"))).toBe(true)
  })
})
