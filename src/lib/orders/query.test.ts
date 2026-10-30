// @vitest-environment node
import { describe, expect, it } from "vitest"

import { ordersHref, parseOrderListQuery } from "./query"

describe("order history query", () => {
  it("accepts the PRD statuses and drops unknown ones", () => {
    expect(parseOrderListQuery({ status: "scheduled" }).status).toBe("scheduled")
    expect(parseOrderListQuery({ status: "preparing" }).status).toBe("all")
  })

  it("normalises paging, search and reversed dates", () => {
    expect(parseOrderListQuery({ page: "-3", q: "  PRV-1  ", from: "2026-10-23", to: "2026-10-01" })).toMatchObject({
      page: 1,
      search: "PRV-1",
      from: "2026-10-01",
      to: "2026-10-23",
    })
  })

  it("builds history URLs", () => {
    const query = parseOrderListQuery({ status: "accepted", q: "PRV" })
    expect(ordersHref(query, { page: 2 })).toBe("/orders/history?status=accepted&q=PRV&page=2")
    expect(ordersHref(parseOrderListQuery({}))).toBe("/orders/history")
  })
})
