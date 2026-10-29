// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  parseSettlementListQuery,
  parseSettlementOrdersQuery,
  SETTLEMENT_ORDERS_PAGE_SIZE,
  SETTLEMENTS_PAGE_SIZE,
  settlementHref,
  settlementsHref,
} from "./query"

describe("parseSettlementListQuery", () => {
  it("uses page 1 for an empty URL", () => {
    expect(parseSettlementListQuery({})).toEqual({ page: 1, pageSize: SETTLEMENTS_PAGE_SIZE })
  })

  it("reads a valid page and takes the first of repeated values", () => {
    expect(parseSettlementListQuery({ page: "3" }).page).toBe(3)
    expect(parseSettlementListQuery({ page: ["2", "9"] }).page).toBe(2)
  })

  it.each(["0", "-1", "3.5", "03", "5abc", " 5", "one", "", "NaN", "9999999", "１"])("falls back to page 1 for %j", (page) => {
    expect(parseSettlementListQuery({ page }).page).toBe(1)
  })

  it("ignores any restaurant, status or sort parameter", () => {
    expect(parseSettlementListQuery({ restaurantId: "other", status: "paid", sort: "net" })).toEqual({
      page: 1,
      pageSize: SETTLEMENTS_PAGE_SIZE,
    })
  })
})

describe("parseSettlementOrdersQuery", () => {
  it("reads the breakdown page from ?orders=", () => {
    expect(parseSettlementOrdersQuery({})).toEqual({ page: 1, pageSize: SETTLEMENT_ORDERS_PAGE_SIZE })
    expect(parseSettlementOrdersQuery({ orders: "2", page: "5" }).page).toBe(2)
    expect(parseSettlementOrdersQuery({ orders: "0" }).page).toBe(1)
  })
})

describe("links", () => {
  it("leaves page 1 out", () => {
    expect(settlementsHref()).toBe("/wallet/settlements")
    expect(settlementsHref(1)).toBe("/wallet/settlements")
    expect(settlementsHref(3)).toBe("/wallet/settlements?page=3")
  })

  it("encodes the settlement id and carries the list page and breakdown page", () => {
    expect(settlementHref("prv-set-01")).toBe("/wallet/settlements/prv-set-01")
    expect(settlementHref("a/b c", 2, 3)).toBe("/wallet/settlements/a%2Fb%20c?page=2&orders=3")
    expect(settlementHref("x", 1, 2)).toBe("/wallet/settlements/x?orders=2")
  })
})
