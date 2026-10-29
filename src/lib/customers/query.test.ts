// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  CUSTOMER_ORDERS_PAGE_SIZE,
  CUSTOMER_SEARCH_MAX_LENGTH,
  CUSTOMERS_PAGE_SIZE,
  customerHref,
  customersHref,
  hasActiveCustomerSearch,
  parseCustomerListQuery,
  parseCustomerOrdersQuery,
} from "./query"

const defaults = { search: "", sort: "recent", page: 1, pageSize: CUSTOMERS_PAGE_SIZE }

describe("parseCustomerListQuery", () => {
  it("uses the defaults for an empty URL: last order newest first", () => {
    expect(parseCustomerListQuery({})).toEqual(defaults)
  })

  it("reads a valid search, sort and page", () => {
    expect(parseCustomerListQuery({ q: "  asha ", sort: "name", page: "3" })).toEqual({
      search: "asha",
      sort: "name",
      page: 3,
      pageSize: CUSTOMERS_PAGE_SIZE,
    })
  })

  it("limits the search to 60 characters", () => {
    expect(parseCustomerListQuery({ q: "x".repeat(200) }).search).toHaveLength(CUSTOMER_SEARCH_MAX_LENGTH)
  })

  it.each(["spend", "orders", "Name", "recent,name", "", "null"])(
    "offers no metric sorting: %j falls back to the default",
    (sort) => {
      expect(parseCustomerListQuery({ sort }).sort).toBe("recent")
    }
  )

  it.each(["0", "-1", "3.5", "03", "5abc", " 5", "one", "", "NaN", "9999999"])("falls back to page 1 for %j", (page) => {
    expect(parseCustomerListQuery({ page }).page).toBe(1)
  })

  it("takes the first of repeated parameters", () => {
    expect(parseCustomerListQuery({ q: ["a", "b"], page: ["2", "3"], sort: ["name", "recent"] })).toMatchObject({
      search: "a",
      page: 2,
      sort: "name",
    })
  })

  it("ignores any restaurant identifier in the URL", () => {
    expect(parseCustomerListQuery({ restaurantId: "other", restaurant: "other" })).toEqual(defaults)
  })
})

describe("parseCustomerOrdersQuery", () => {
  it("reads the history page from ?orders=", () => {
    expect(parseCustomerOrdersQuery({})).toEqual({ page: 1, pageSize: CUSTOMER_ORDERS_PAGE_SIZE })
    expect(parseCustomerOrdersQuery({ orders: "2", page: "5" }).page).toBe(2)
    expect(parseCustomerOrdersQuery({ orders: "0" }).page).toBe(1)
  })
})

describe("links", () => {
  const query = { search: "asha", sort: "name" as const, page: 2 }

  it("keeps the search and sort and leaves defaults out", () => {
    expect(customersHref({ search: "", sort: "recent", page: 1 })).toBe("/customers")
    expect(customersHref(query)).toBe("/customers?q=asha&sort=name&page=2")
    expect(customersHref(query, { page: 1 })).toBe("/customers?q=asha&sort=name")
  })

  it("encodes the customer id and carries the list view to the profile", () => {
    expect(customerHref("prv-cus-01", { search: "", sort: "recent", page: 1 })).toBe("/customers/prv-cus-01")
    expect(customerHref("a/b c", query, 3)).toBe("/customers/a%2Fb%20c?q=asha&sort=name&page=2&orders=3")
  })

  it("reports an active search", () => {
    expect(hasActiveCustomerSearch({ search: "a" })).toBe(true)
    expect(hasActiveCustomerSearch({ search: "" })).toBe(false)
  })
})
