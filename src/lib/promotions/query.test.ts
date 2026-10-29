// @vitest-environment node
import { describe, expect, it } from "vitest"

import { hasActivePromotionFilter, parsePromotionListQuery, promotionHref, promotionsHref, PROMOTIONS_PAGE_SIZE } from "./query"

const defaults = { status: "all", page: 1, pageSize: PROMOTIONS_PAGE_SIZE }

describe("parsePromotionListQuery", () => {
  it("uses the defaults for an empty URL", () => {
    expect(parsePromotionListQuery({})).toEqual(defaults)
  })

  it.each(["scheduled", "active", "paused", "expired", "cancelled", "all"])("reads the status %s", (status) => {
    expect(parsePromotionListQuery({ status }).status).toBe(status)
  })

  it.each(["Active", "ACTIVE", "live", "ended", "draft", "", "active,paused", " active", "null", "1"])(
    "falls back to all for the unknown status %j",
    (status) => {
      expect(parsePromotionListQuery({ status }).status).toBe("all")
    }
  )

  it("reads a valid page and takes the first of repeated values", () => {
    expect(parsePromotionListQuery({ page: "3" }).page).toBe(3)
    expect(parsePromotionListQuery({ status: ["paused", "active"], page: ["2", "9"] })).toMatchObject({ status: "paused", page: 2 })
  })

  it.each(["0", "-1", "3.5", "03", "5abc", " 5", "one", "", "NaN", "9999999", "１"])("falls back to page 1 for %j", (page) => {
    expect(parsePromotionListQuery({ page }).page).toBe(1)
  })

  it("ignores any restaurant, kind, code or search parameter", () => {
    expect(parsePromotionListQuery({ restaurantId: "other", kind: "bogo", code: "X", q: "x", sort: "name" })).toEqual(defaults)
  })
})

describe("links", () => {
  const query = { status: "paused" as const, page: 2 }

  it("keeps the filter and page and leaves defaults out", () => {
    expect(promotionsHref({ status: "all", page: 1 })).toBe("/promotions")
    expect(promotionsHref(query)).toBe("/promotions?status=paused&page=2")
    expect(promotionsHref(query, { page: 1 })).toBe("/promotions?status=paused")
    expect(promotionsHref(query, { status: "all", page: 1 })).toBe("/promotions")
  })

  it("encodes the coupon id and carries the list view to the detail page", () => {
    expect(promotionHref("prv-promo-01", { status: "all", page: 1 })).toBe("/promotions/prv-promo-01")
    expect(promotionHref("a/b c", query)).toBe("/promotions/a%2Fb%20c?status=paused&page=2")
  })

  it("reports an active filter", () => {
    expect(hasActivePromotionFilter({ status: "active" })).toBe(true)
    expect(hasActivePromotionFilter({ status: "all" })).toBe(false)
  })
})
