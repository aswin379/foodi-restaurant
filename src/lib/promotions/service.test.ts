// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { promotionFromApi } from "./api-mapping"
import { buildFixturePromotions } from "./fixtures/promotions"
import { parsePromotionListQuery } from "./query"
import { getPromotion, getPromotionsContext, listPromotions, promotionsMode } from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const query = (params: Record<string, string> = {}) => parsePromotionListQuery(params)
const notConfigured = expect.objectContaining({ kind: "not_configured" })

beforeEach(() => {
  vi.stubEnv("FOODI_PROMOTIONS_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => {
  clearPreviewCollections()
  vi.unstubAllEnvs()
})

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("FOODI_PROMOTIONS_DATA_SOURCE", "preview")
}

describe("promotions data source", () => {
  it("refuses preview data in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview", "PREVIEW", "true"]) {
      vi.stubEnv("FOODI_PROMOTIONS_DATA_SOURCE", value)
      expect(promotionsMode()).toBe("api")
      await expect(listPromotions(query())).rejects.toEqual(notConfigured)
      await expect(getPromotion("prv-promo-01")).rejects.toEqual(notConfigured)
      await expect(getPromotionsContext()).rejects.toEqual(notConfigured)
    }
  })

  it("ignores preview scenarios in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_PROMOTIONS_DATA_SOURCE", "preview")
    for (const scenario of ["empty", "error", "slow", "forbidden"]) {
      await expect(listPromotions(query(), scenario)).rejects.toEqual(notConfigured)
      await expect(getPromotion("prv-promo-01", scenario)).rejects.toEqual(notConfigured)
    }
  })

  it("uses the API (not configured) outside production unless preview is chosen, with no fallback", async () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(promotionsMode()).toBe("api")
    await expect(listPromotions(query())).rejects.toEqual(notConfigured)
    await expect(getPromotion("prv-promo-01")).rejects.toEqual(notConfigured)
  })
})

describe("preview promotions", () => {
  beforeEach(preview)

  it("lists ten coupons a page with totals", async () => {
    const first = await listPromotions(query())
    expect(first).toMatchObject({ page: 1, pageSize: 10, totalItems: 14, totalPages: 2, hasNextPage: true })
    expect(first.items).toHaveLength(10)
    const second = await listPromotions(query({ page: "2" }))
    expect(second.items).toHaveLength(4)
    expect(second.hasNextPage).toBe(false)
    expect((await listPromotions(query({ page: "99" }))).page).toBe(2)
  })

  it("filters by the status the fixtures report, and a coupon with no status appears only under all", async () => {
    const counts = { scheduled: 2, active: 5, paused: 2, expired: 2, cancelled: 2 }
    for (const [status, count] of Object.entries(counts)) {
      const result = await listPromotions(query({ status }))
      expect(result.totalItems).toBe(count)
      expect(result.items.every((item) => item.status === status)).toBe(true)
    }
    const all = [...(await listPromotions(query())).items, ...(await listPromotions(query({ page: "2" }))).items]
    expect(all.filter((item) => item.status === null)).toHaveLength(1)
  })

  it("serves both discount types, every funding, and coupons with nothing optional", async () => {
    const all = [...(await listPromotions(query())).items, ...(await listPromotions(query({ page: "2" }))).items]
    expect(new Set(all.map((item) => item.discount.type))).toEqual(new Set(["percentage", "fixed_amount"]))
    expect(new Set(all.map((item) => item.fundedBy))).toEqual(new Set(["restaurant", "foodi", "shared", null]))
    expect(all.find((item) => item.code === "PREVIEW-BARE")).toMatchObject({ redemptionCount: null, startsAt: null, orderTypes: null })
    expect(all.find((item) => item.code === "PREVIEW-ZERO")).toMatchObject({ redemptionCount: 0 })
  })

  it("returns a coupon by id, and null for an unknown one", async () => {
    expect(await getPromotion("prv-promo-01")).toMatchObject({ id: "prv-promo-01", code: "PREVIEW-SOON11" })
    expect(await getPromotion("prv-promo-99")).toBeNull()
  })

  it("supports the empty, error and forbidden scenarios", async () => {
    expect((await listPromotions(query(), "empty")).totalItems).toBe(0)
    expect(await getPromotion("prv-promo-01", "empty")).toBeNull()
    await expect(listPromotions(query(), "error")).rejects.toEqual(expect.objectContaining({ kind: "unavailable" }))
    await expect(listPromotions(query(), "forbidden")).rejects.toEqual(expect.objectContaining({ kind: "forbidden" }))
    await expect(getPromotion("prv-promo-01", "error")).rejects.toEqual(expect.objectContaining({ kind: "unavailable" }))
  })
})

describe("preview fixtures", () => {
  it("pass the same strict mapper the API uses", () => {
    vi.stubEnv("NODE_ENV", "development")
    for (const promotion of buildFixturePromotions(Date.now())) {
      expect(promotionFromApi(JSON.parse(JSON.stringify(promotion)), { currency: "INR" })).toEqual(promotion)
    }
  })

  it("use obviously fictional codes and values, and no customer data", () => {
    vi.stubEnv("NODE_ENV", "development")
    const promotions = buildFixturePromotions(Date.now())
    for (const promotion of promotions) {
      expect(promotion.code).toMatch(/^PREVIEW-/)
      // Obviously fictional: repeating digits (11.11, 22.22, 55.55 ...).
      if (promotion.discount.type === "fixed_amount") {
        expect(new Set(String(promotion.discount.amount.amountMinor)).size).toBe(1)
      }
    }
    // Only the displayed text is checked: field names such as perCustomerLimit are not customer data.
    const text = JSON.stringify(promotions.map((promotion) => [promotion.code, promotion.name]))
    expect(text).not.toMatch(/GST|@|customer|phone/i)
    expect(new Set(promotions.map((promotion) => promotion.id)).size).toBe(promotions.length)
  })
})
