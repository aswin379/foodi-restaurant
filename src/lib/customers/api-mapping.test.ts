// @vitest-environment node
import { describe, expect, it } from "vitest"

import { customerDetailFromApi, customerFromApi, customerListFromApi, customerOrdersFromApi } from "./api-mapping"

const expected = { currency: "INR" }
const customer = {
  id: "cus_1",
  displayName: "Preview customer 01",
  phoneMasked: "•••••• ••10",
  emailMasked: "p•••@e•••••.example",
  orderCount: 3,
  lifetimeSpend: { amountMinor: 120000, currency: "INR" },
  lastOrderAt: "2026-10-01T10:00:00Z",
}
const page = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false }
const order = {
  id: "ord_1",
  reference: "PRV-1001",
  placedAt: "2026-10-01T10:00:00Z",
  status: "completed",
  paymentStatus: "paid",
  orderType: "takeaway",
  deliveryMode: null,
  itemCount: 2,
  total: { amountMinor: 52000, currency: "INR" },
}
const rejects = (run: () => unknown) => expect(run).toThrow(expect.objectContaining({ kind: "unavailable" }))

describe("customerFromApi", () => {
  it("maps a complete customer", () => {
    expect(customerFromApi(customer, expected)).toEqual(customer)
  })

  it("keeps missing fields and metrics as null, never zero (C9)", () => {
    expect(customerFromApi({ id: "cus_2" }, expected)).toEqual({
      id: "cus_2",
      displayName: null,
      phoneMasked: null,
      emailMasked: null,
      orderCount: null,
      lifetimeSpend: null,
      lastOrderAt: null,
    })
  })

  it("keeps a real zero order count as zero", () => {
    expect(customerFromApi({ ...customer, orderCount: 0 }, expected).orderCount).toBe(0)
  })

  it("reads only the fields it knows: a raw phone, email or address never reaches the model (C6)", () => {
    const mapped = customerFromApi(
      { ...customer, phone: "+10000000000", email: "someone@example.com", address: "1 Example Street", restaurantId: "r1" },
      expected
    )
    expect(JSON.stringify(mapped)).not.toMatch(/10000000000|someone@|Example Street|restaurantId/)
    expect(Object.keys(mapped).sort()).toEqual(
      ["displayName", "emailMasked", "id", "lastOrderAt", "lifetimeSpend", "orderCount", "phoneMasked"]
    )
  })

  it.each([
    ["a full phone number", { phoneMasked: "+1 555 010 0199" }],
    ["a phone with only digits", { phoneMasked: "5550100199" }],
    ["an unmasked phone with a star-free format", { phoneMasked: "555-0100" }],
    ["a full email address", { emailMasked: "someone@example.com" }],
    ["an email in the name", { displayName: "someone@example.com" }],
    ["a phone number in the name", { displayName: "555 010 0199" }],
  ])("refuses %s as a value that isn't masked", (_label, patch) => {
    rejects(() => customerFromApi({ ...customer, ...patch }, expected))
  })

  it("never repeats a refused value in the error", () => {
    try {
      customerFromApi({ ...customer, phoneMasked: "+1 555 010 0199" }, expected)
      expect.unreachable()
    } catch (error) {
      expect(String((error as Error).message)).not.toMatch(/555/)
    }
  })

  it.each([
    ["a number as id", { id: 12 }],
    ["an id with a slash", { id: "a/b" }],
    ["an empty id", { id: "" }],
    ["a blank name", { displayName: "  " }],
    ["a negative count", { orderCount: -1 }],
    ["a fractional count", { orderCount: 1.5 }],
    ["a string count", { orderCount: "3" }],
    ["a fractional amount", { lifetimeSpend: { amountMinor: 10.5, currency: "INR" } }],
    ["a negative amount", { lifetimeSpend: { amountMinor: -1, currency: "INR" } }],
    ["another currency", { lifetimeSpend: { amountMinor: 100, currency: "USD" } }],
    ["a bad date", { lastOrderAt: "yesterday" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => customerFromApi({ ...customer, ...patch }, expected))
  })

  it.each([null, "x", 1, []])("refuses %j as a customer", (value) => {
    rejects(() => customerFromApi(value, expected))
  })
})

describe("customerDetailFromApi", () => {
  it("adds the first order date, null when absent", () => {
    expect(customerDetailFromApi({ ...customer, firstOrderAt: "2026-01-01T00:00:00Z" }, expected).firstOrderAt).toBe(
      "2026-01-01T00:00:00Z"
    )
    expect(customerDetailFromApi(customer, expected).firstOrderAt).toBeNull()
    rejects(() => customerDetailFromApi({ ...customer, firstOrderAt: "soon" }, expected))
  })
})

describe("customerListFromApi", () => {
  it("maps a page with totals and supported sorts", () => {
    const result = customerListFromApi({ items: [customer], ...page, supportedSorts: ["recent", "name"] }, expected)
    expect(result.items).toHaveLength(1)
    expect(result).toMatchObject({ ...page, supportedSorts: ["recent", "name"] })
  })

  it("accepts a source with no totals: they stay null, never invented (C9)", () => {
    const result = customerListFromApi(
      { items: [customer], page: 2, pageSize: 10, totalItems: null, totalPages: null, hasNextPage: true },
      expected
    )
    expect(result).toMatchObject({ page: 2, totalItems: null, totalPages: null, hasNextPage: true })
  })

  it("treats missing supported sorts as none, so no sort is assumed (C8, C9)", () => {
    expect(customerListFromApi({ items: [], ...page }, expected).supportedSorts).toEqual([])
  })

  it.each([
    ["a missing items list", { items: undefined }],
    ["a missing next-page flag", { hasNextPage: undefined }],
    ["a page size of zero", { pageSize: 0 }],
    ["more items than the page size", { items: Array(11).fill(customer) }],
    ["totals that disagree", { totalItems: 25, totalPages: 1 }],
    ["a next-page flag that contradicts the totals", { totalItems: 25, totalPages: 3, hasNextPage: false }],
    ["an unknown sort", { supportedSorts: ["spend"] }],
    ["a page of zero", { page: 0 }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => customerListFromApi({ items: [customer], ...page, ...patch }, expected))
  })

  it("refuses a malformed customer anywhere in the list", () => {
    rejects(() => customerListFromApi({ items: [customer, { id: "" }], ...page }, expected))
  })
})

describe("customerOrdersFromApi", () => {
  it("maps order history rows", () => {
    expect(customerOrdersFromApi({ items: [order], ...page }, expected).items).toEqual([order])
  })

  it("requires a delivery mode for delivery orders only", () => {
    const delivery = { ...order, orderType: "delivery", deliveryMode: "foodi" }
    expect(customerOrdersFromApi({ items: [delivery], ...page }, expected).items[0].deliveryMode).toBe("foodi")
    rejects(() => customerOrdersFromApi({ items: [{ ...order, orderType: "delivery" }], ...page }, expected))
    rejects(() => customerOrdersFromApi({ items: [{ ...order, deliveryMode: "foodi" }], ...page }, expected))
  })

  it.each([
    ["an unknown status", { status: "done" }],
    ["an unknown payment status", { paymentStatus: "maybe" }],
    ["an unsafe order id", { id: "../x" }],
    ["another currency", { total: { amountMinor: 1, currency: "USD" } }],
    ["a bad date", { placedAt: "x" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => customerOrdersFromApi({ items: [{ ...order, ...patch }], ...page }, expected))
  })

  it("ignores any customer name or contact field sent with an order", () => {
    const mapped = customerOrdersFromApi({ items: [{ ...order, customerName: "Someone", phone: "+10000000000" }], ...page }, expected)
    expect(JSON.stringify(mapped)).not.toMatch(/Someone|10000000000/)
  })
})
