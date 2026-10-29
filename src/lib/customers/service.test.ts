// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"
import { buildFixtureOrders } from "@/lib/orders/fixtures/orders"

import { buildFixtureCustomers } from "./fixtures/customers"
import { parseCustomerListQuery, parseCustomerOrdersQuery } from "./query"
import { customersMode, getCustomer, getCustomersContext, listCustomerOrders, listCustomers } from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const query = (params: Record<string, string> = {}) => parseCustomerListQuery(params)
const orders = (params: Record<string, string> = {}) => parseCustomerOrdersQuery(params)
const notConfigured = expect.objectContaining({ kind: "not_configured" })

beforeEach(() => {
  vi.stubEnv("FOODI_CUSTOMERS_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => {
  clearPreviewCollections()
  vi.unstubAllEnvs()
})

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("FOODI_CUSTOMERS_DATA_SOURCE", "preview")
}

describe("customers data source", () => {
  it("refuses preview data in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview", "PREVIEW", "true"]) {
      vi.stubEnv("FOODI_CUSTOMERS_DATA_SOURCE", value)
      expect(customersMode()).toBe("api")
      await expect(listCustomers(query())).rejects.toEqual(notConfigured)
      await expect(getCustomer("prv-cus-01")).rejects.toEqual(notConfigured)
      await expect(listCustomerOrders("prv-cus-01", orders())).rejects.toEqual(notConfigured)
      await expect(getCustomersContext()).rejects.toEqual(notConfigured)
    }
  })

  it("ignores preview scenarios in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_CUSTOMERS_DATA_SOURCE", "preview")
    for (const scenario of ["empty", "error", "slow", "forbidden"]) {
      await expect(listCustomers(query(), scenario)).rejects.toEqual(notConfigured)
      await expect(getCustomer("prv-cus-01", scenario)).rejects.toEqual(notConfigured)
    }
  })

  it("uses the API (not configured) outside production unless preview is chosen, with no fallback", async () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(customersMode()).toBe("api")
    await expect(listCustomers(query())).rejects.toEqual(notConfigured)
    await expect(getCustomer("prv-cus-01")).rejects.toEqual(notConfigured)
  })

  it("never creates preview data in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_CUSTOMERS_DATA_SOURCE", "preview")
    expect(customersMode()).toBe("api")
  })
})

describe("preview customers", () => {
  beforeEach(preview)

  it("lists ten per page with authoritative totals, last order first", async () => {
    const first = await listCustomers(query())
    expect(first).toMatchObject({ page: 1, pageSize: 10, totalItems: 25, totalPages: 3, hasNextPage: true })
    expect(first.items).toHaveLength(10)
    expect(first.supportedSorts).toEqual(["recent", "name"])

    const dates = first.items.map((customer) => customer.lastOrderAt)
    const sorted = [...dates].sort((a, b) => (b ?? "").localeCompare(a ?? ""))
    expect(dates.filter(Boolean)).toEqual(sorted.filter(Boolean))

    const last = await listCustomers(query({ page: "3" }))
    expect(last.items).toHaveLength(5)
    expect(last.hasNextPage).toBe(false)
  })

  it("puts customers with no last order date after those that have one", async () => {
    const all = (await Promise.all([1, 2, 3].map((page) => listCustomers(query({ page: String(page) }))))).flatMap(
      (result) => result.items
    )
    const firstUndated = all.findIndex((customer) => customer.lastOrderAt === null)
    expect(firstUndated).toBeGreaterThan(-1)
    expect(all.slice(firstUndated).every((customer) => customer.lastOrderAt === null)).toBe(true)
  })

  it("sorts by name A–Z with unnamed customers last", async () => {
    const all = (await Promise.all([1, 2, 3].map((page) => listCustomers(query({ sort: "name", page: String(page) }))))).flatMap(
      (result) => result.items
    )
    const named = all.filter((customer) => customer.displayName !== null)
    expect(named.map((customer) => customer.displayName)).toEqual([...named.map((customer) => customer.displayName)].sort())
    expect(all.at(-1)?.displayName).toBeNull()
  })

  it("searches names case-insensitively and never matches an unnamed customer", async () => {
    const result = await listCustomers(query({ q: "CUSTOMER 1" }))
    expect(result.totalItems).toBe(10)
    expect(result.items.every((customer) => /customer 1/i.test(customer.displayName ?? ""))).toBe(true)
    expect((await listCustomers(query({ q: "zzz" }))).items).toEqual([])
    expect((await listCustomers(query({ q: "no" }))).items.some((customer) => customer.displayName === null)).toBe(false)
  })

  it("does not match by contact details", async () => {
    expect((await listCustomers(query({ q: "example" }))).items).toEqual([])
    expect((await listCustomers(query({ q: "••" }))).items).toEqual([])
  })

  it("shows the last page for a page past the end", async () => {
    expect((await listCustomers(query({ page: "99" }))).page).toBe(3)
  })

  it("keeps order history out of the list and detail results", async () => {
    const { items } = await listCustomers(query())
    expect(JSON.stringify(items)).not.toContain('"orders"')
    expect(JSON.stringify(await getCustomer("prv-cus-01"))).not.toContain('"orders"')
  })

  it("returns null for an unknown customer, for both profile and history", async () => {
    expect(await getCustomer("prv-cus-999")).toBeNull()
    expect(await listCustomerOrders("prv-cus-999", orders())).toBeNull()
  })

  it("pages a long order history, newest first", async () => {
    const one = await listCustomerOrders("prv-cus-01", orders())
    expect(one).toMatchObject({ page: 1, pageSize: 10, totalItems: 14, totalPages: 2, hasNextPage: true })
    const two = await listCustomerOrders("prv-cus-01", orders({ orders: "2" }))
    expect(two?.items).toHaveLength(4)
    const all = [...one!.items, ...two!.items].map((order) => order.placedAt)
    expect(all).toEqual([...all].sort().reverse())
  })

  it("gives a customer with no orders an empty history", async () => {
    expect(await listCustomerOrders("prv-cus-25", orders())).toMatchObject({ items: [], totalItems: 0, hasNextPage: false })
  })

  it("shows the unavailable-metric customers with null metrics, not zeros (C9)", async () => {
    expect(await getCustomer("prv-cus-03")).toMatchObject({ orderCount: null, lifetimeSpend: null })
    expect(await getCustomer("prv-cus-07")).toMatchObject({ lastOrderAt: null, firstOrderAt: null })
  })

  it("reports a server-style count and spend of completed orders only", async () => {
    const customer = await getCustomer("prv-cus-01")
    const history = [
      ...(await listCustomerOrders("prv-cus-01", orders()))!.items,
      ...(await listCustomerOrders("prv-cus-01", orders({ orders: "2" })))!.items,
    ]
    const completed = history.filter((order) => order.status === "completed")
    expect(customer?.orderCount).toBe(completed.length)
    expect(customer?.lifetimeSpend?.amountMinor).toBe(completed.reduce((sum, order) => sum + order.total.amountMinor, 0))
    expect(history.some((order) => order.status !== "completed")).toBe(true)
  })

  it("supports the empty, error and forbidden scenarios", async () => {
    expect((await listCustomers(query(), "empty")).totalItems).toBe(0)
    expect(await getCustomer("prv-cus-01", "empty")).toBeNull()
    await expect(listCustomers(query(), "error")).rejects.toEqual(expect.objectContaining({ kind: "unavailable" }))
    await expect(listCustomers(query(), "forbidden")).rejects.toEqual(expect.objectContaining({ kind: "forbidden" }))
    await expect(listCustomerOrders("prv-cus-01", orders(), "error")).rejects.toEqual(
      expect.objectContaining({ kind: "unavailable" })
    )
  })
})

describe("preview fixtures", () => {
  it("link every history row to a sample order that exists, with the same total", () => {
    vi.stubEnv("NODE_ENV", "development")
    const sampleOrders = new Map(buildFixtureOrders(Date.now()).map((order) => [order.id, order]))
    const customers = buildFixtureCustomers(Date.now())
    const rows = customers.flatMap((customer) => customer.orders)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(sampleOrders.get(row.id)?.total).toEqual(row.total)
      expect(sampleOrders.get(row.id)?.reference).toBe(row.reference)
    }
    // A guest order belongs to no customer (C2), and no order belongs to two.
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
    expect(rows.length).toBeLessThan(sampleOrders.size)
  })

  it("contain no real or realistic contact details", () => {
    vi.stubEnv("NODE_ENV", "development")
    for (const customer of buildFixtureCustomers(Date.now())) {
      if (customer.phoneMasked) {
        expect(customer.phoneMasked).toMatch(/•/)
        expect(customer.phoneMasked.match(/\d/g)?.length ?? 0).toBeLessThanOrEqual(2)
      }
      if (customer.emailMasked) expect(customer.emailMasked).toMatch(/•.*\.example$/)
      if (customer.displayName !== null) expect(customer.displayName).toMatch(/^Preview customer \d+$/)
    }
  })
})
