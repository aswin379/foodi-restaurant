// @vitest-environment node
import { describe, expect, it } from "vitest"

import { promotionFromApi, promotionListFromApi } from "./api-mapping"

const expected = { currency: "INR" }
const inr = (amountMinor: number) => ({ amountMinor, currency: "INR" })
const percentage = { type: "percentage", rateBasisPoints: 1234, maxDiscount: inr(5555) }
const fixed = { type: "fixed_amount", amount: inr(1111) }
const promotion = {
  id: "promo_1",
  kind: "coupon",
  code: "PREVIEW-TEST1",
  name: "Test coupon",
  status: "active",
  discount: percentage,
  minimumOrder: inr(11100),
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-11-01T00:00:00Z",
  orderTypes: ["delivery", "takeaway"],
  appliesTo: ["subtotal", "packaging_fee"],
  fundedBy: "shared",
  managedBy: "foodi",
  stackable: false,
  usageLimit: 100,
  perCustomerLimit: 2,
  redemptionCount: 7,
}
const page = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false }
const bare = { id: "promo_2", kind: "coupon", code: "PREVIEW-BARE", discount: fixed }
const rejects = (run: () => unknown) => expect(run).toThrow(expect.objectContaining({ kind: "unavailable" }))

describe("promotionFromApi", () => {
  it("maps a complete coupon exactly as supplied", () => {
    expect(promotionFromApi(promotion, expected)).toEqual(promotion)
  })

  it("keeps every optional value null, never a default", () => {
    expect(promotionFromApi(bare, expected)).toEqual({
      id: "promo_2",
      kind: "coupon",
      code: "PREVIEW-BARE",
      name: null,
      status: null,
      discount: fixed,
      minimumOrder: null,
      startsAt: null,
      endsAt: null,
      orderTypes: null,
      appliesTo: null,
      fundedBy: null,
      managedBy: null,
      stackable: null,
      usageLimit: null,
      perCustomerLimit: null,
      redemptionCount: null,
    })
  })

  it("keeps real zeros and false as they are, and a missing value as null", () => {
    const mapped = promotionFromApi(
      { ...promotion, redemptionCount: 0, stackable: false, minimumOrder: inr(0), discount: { ...percentage, rateBasisPoints: 0 } },
      expected
    )
    expect(mapped).toMatchObject({ redemptionCount: 0, stackable: false, minimumOrder: inr(0) })
    expect(mapped.discount).toMatchObject({ rateBasisPoints: 0 })
    expect(promotionFromApi(bare, expected)).toMatchObject({ redemptionCount: null, stackable: null })
  })

  it("derives and calculates nothing: no saving, no status from a date, no eligibility, no funding", () => {
    // Dates in the past with an "active" status stay "active"; an absent status stays null.
    expect(promotionFromApi({ ...promotion, startsAt: "2000-01-01T00:00:00Z", endsAt: "2000-02-01T00:00:00Z" }, expected).status).toBe("active")
    expect(promotionFromApi({ ...promotion, status: null, startsAt: "2000-01-01T00:00:00Z", endsAt: "2000-02-01T00:00:00Z" }, expected).status).toBeNull()
    expect(promotionFromApi({ ...promotion, fundedBy: null }, expected).fundedBy).toBeNull()
    expect(Object.keys(promotionFromApi(promotion, expected)).sort()).toEqual(
      [
        "appliesTo", "code", "discount", "endsAt", "fundedBy", "id", "kind", "managedBy", "minimumOrder", "name",
        "orderTypes", "perCustomerLimit", "redemptionCount", "stackable", "startsAt", "status", "usageLimit",
      ]
    )
  })

  it("reads only known fields: customer, order and redemption-history data never reach the model", () => {
    const mapped = promotionFromApi(
      {
        ...promotion,
        redemptions: [{ customer: "Someone", phone: "+10000000000", orderId: "o1" }],
        customerName: "Someone",
        email: "someone@example.com",
        restaurantId: "r1",
      },
      expected
    )
    expect(JSON.stringify(mapped)).not.toMatch(/Someone|10000000000|someone@|restaurantId|o1/)
  })

  it.each(["scheduled", "active", "paused", "expired", "cancelled"])("accepts the proposed status %s", (status) => {
    expect(promotionFromApi({ ...promotion, status }, expected).status).toBe(status)
  })

  it.each(["restaurant", "foodi", "shared"])("accepts the proposed funding %s", (fundedBy) => {
    expect(promotionFromApi({ ...promotion, fundedBy }, expected).fundedBy).toBe(fundedBy)
  })

  it.each(["restaurant", "foodi"])("accepts the proposed manager %s", (managedBy) => {
    expect(promotionFromApi({ ...promotion, managedBy }, expected).managedBy).toBe(managedBy)
  })

  it.each([
    ["a Release 2 kind", { kind: "bogo" }],
    ["happy hour", { kind: "happy_hour" }],
    ["a missing kind", { kind: undefined }],
    ["an unknown status", { status: "live" }],
    ["a status in another case", { status: "Active" }],
    ["an unknown funding", { fundedBy: "partner" }],
    ["an unknown manager", { managedBy: "admin" }],
    ["a bad promotion id", { id: "a/b" }],
    ["a missing promotion id", { id: undefined }],
    ["a blank code", { code: "  " }],
    ["a code with a space", { code: "TWO WORDS" }],
    ["a code with a control character", { code: "AB\u0000CD" }],
    ["a very long code", { code: "X".repeat(41) }],
    ["a missing code", { code: undefined }],
    ["a blank name", { name: " " }],
    ["a very long name", { name: "x".repeat(100) }],
    ["a missing discount", { discount: undefined }],
    ["a non-boolean stackable flag", { stackable: "yes" }],
    ["a zero usage limit", { usageLimit: 0 }],
    ["a zero per-customer limit", { perCustomerLimit: 0 }],
    ["a fractional limit", { usageLimit: 1.5 }],
    ["a negative redemption count", { redemptionCount: -1 }],
    ["a fractional redemption count", { redemptionCount: 1.5 }],
    ["a string redemption count", { redemptionCount: "7" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => promotionFromApi({ ...promotion, ...patch }, expected))
  })

  describe("discount", () => {
    it.each([
      ["a percentage with no rate", { type: "percentage" }],
      ["a percentage with a fixed amount", { ...percentage, amount: inr(1) }],
      ["a fixed amount with no amount", { type: "fixed_amount" }],
      ["a fixed amount with a rate", { ...fixed, rateBasisPoints: 100 }],
      ["a fixed amount with a cap", { ...fixed, maxDiscount: inr(100) }],
      ["an unknown type", { type: "buy_one_get_one" }],
      ["a rate over 100 percent", { ...percentage, rateBasisPoints: 10_001 }],
      ["a negative rate", { ...percentage, rateBasisPoints: -1 }],
      ["a fractional rate", { ...percentage, rateBasisPoints: 12.5 }],
      ["a string rate", { ...percentage, rateBasisPoints: "1234" }],
      ["a fractional amount", { type: "fixed_amount", amount: inr(10.5) }],
      ["a negative amount", { type: "fixed_amount", amount: inr(-1) }],
      ["an unsafe amount", { type: "fixed_amount", amount: inr(2 ** 60) }],
      ["a string amount", { type: "fixed_amount", amount: { amountMinor: "100", currency: "INR" } }],
      ["another currency", { type: "fixed_amount", amount: { amountMinor: 100, currency: "USD" } }],
      ["a missing currency", { type: "fixed_amount", amount: { amountMinor: 100 } }],
      ["a negative cap", { ...percentage, maxDiscount: inr(-1) }],
      ["a cap in another currency", { ...percentage, maxDiscount: { amountMinor: 1, currency: "EUR" } }],
      ["a discount that is not an object", "10% off"],
    ])("refuses %s", (_label, discount) => {
      rejects(() => promotionFromApi({ ...promotion, discount }, expected))
    })

    it("accepts a percentage with no cap, a fixed amount, a zero amount and the 100 percent limit", () => {
      expect(promotionFromApi({ ...promotion, discount: { type: "percentage", rateBasisPoints: 500 } }, expected).discount).toEqual({
        type: "percentage",
        rateBasisPoints: 500,
        maxDiscount: null,
      })
      expect(promotionFromApi({ ...promotion, discount: fixed }, expected).discount).toEqual(fixed)
      expect(promotionFromApi({ ...promotion, discount: { type: "fixed_amount", amount: inr(0) } }, expected).discount).toMatchObject({ amount: inr(0) })
      expect(promotionFromApi({ ...promotion, discount: { ...percentage, rateBasisPoints: 10_000 } }, expected).discount).toMatchObject({
        rateBasisPoints: 10_000,
      })
    })
  })

  describe("validity and eligibility", () => {
    it.each([
      ["a text start", { startsAt: "tomorrow" }],
      ["loose date text that Date.parse accepts", { startsAt: "20 Oct" }],
      ["a calendar date with no time", { startsAt: "2026-10-01" }],
      ["a time with no offset", { startsAt: "2026-10-01T00:00:00" }],
      ["a space instead of T", { startsAt: "2026-10-01 00:00:00Z" }],
      ["an end before the start", { startsAt: "2026-11-02T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }],
      ["a minimum order in another currency", { minimumOrder: { amountMinor: 1, currency: "USD" } }],
      ["a fractional minimum order", { minimumOrder: inr(1.5) }],
      ["an empty order types list", { orderTypes: [] }],
      ["an unknown order type", { orderTypes: ["pickup"] }],
      ["duplicate order types", { orderTypes: ["delivery", "delivery"] }],
      ["order types that are not a list", { orderTypes: "delivery" }],
      ["an empty applies-to list", { appliesTo: [] }],
      ["an unknown component", { appliesTo: ["tax"] }],
      ["duplicate components", { appliesTo: ["subtotal", "subtotal"] }],
    ])("refuses %s", (_label, patch) => {
      rejects(() => promotionFromApi({ ...promotion, ...patch }, expected))
    })

    it("accepts an offset instead of Z, and fractional seconds", () => {
      expect(promotionFromApi({ ...promotion, startsAt: "2026-10-01T05:30:00+05:30", endsAt: "2026-11-01T00:00:00.500Z" }, expected).startsAt).toBe(
        "2026-10-01T05:30:00+05:30"
      )
    })

    it("accepts a start with no end, an end with no start, and equal instants", () => {
      expect(promotionFromApi({ ...promotion, endsAt: null }, expected).endsAt).toBeNull()
      expect(promotionFromApi({ ...promotion, startsAt: null }, expected).startsAt).toBeNull()
      expect(promotionFromApi({ ...promotion, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" }, expected).startsAt).toBe(
        "2026-10-01T00:00:00Z"
      )
    })

    it("treats a missing order-types or applies-to list as unknown, never as all", () => {
      const mapped = promotionFromApi(bare, expected)
      expect(mapped.orderTypes).toBeNull()
      expect(mapped.appliesTo).toBeNull()
    })
  })

  it("never repeats a refused value in the error", () => {
    try {
      promotionFromApi({ ...promotion, discount: { type: "fixed_amount", amount: { amountMinor: "0000111122223333", currency: "INR" } } }, expected)
      expect.unreachable()
    } catch (error) {
      expect(String((error as Error).message)).not.toMatch(/0000/)
    }
  })

  it.each([null, "x", 1, [], undefined])("refuses %j as a coupon", (value) => {
    rejects(() => promotionFromApi(value, expected))
  })
})

describe("promotionListFromApi", () => {
  it("maps a page with totals", () => {
    const result = promotionListFromApi({ items: [promotion, bare], ...page, totalItems: 2 }, expected)
    expect(result.items).toHaveLength(2)
    expect(result).toMatchObject({ page: 1, pageSize: 10, totalItems: 2, totalPages: 1, hasNextPage: false })
  })

  it("accepts a source with no totals: they stay null, never invented", () => {
    const result = promotionListFromApi({ items: [promotion], page: 2, pageSize: 10, totalItems: null, totalPages: null, hasNextPage: true }, expected)
    expect(result).toMatchObject({ page: 2, totalItems: null, totalPages: null, hasNextPage: true })
  })

  it.each([
    ["a missing items list", { items: undefined }],
    ["a missing next-page flag", { hasNextPage: undefined }],
    ["a page size of zero", { pageSize: 0 }],
    ["more items than the page size", { items: Array(11).fill(promotion) }],
    ["totals that disagree", { totalItems: 25, totalPages: 1 }],
    ["a next-page flag that contradicts the totals", { totalItems: 25, totalPages: 3, hasNextPage: false }],
    ["a page of zero", { page: 0 }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => promotionListFromApi({ items: [promotion], ...page, ...patch }, expected))
  })

  it("refuses a malformed coupon anywhere in the list", () => {
    rejects(() => promotionListFromApi({ items: [promotion, { ...promotion, kind: "bogo" }], ...page }, expected))
  })
})
