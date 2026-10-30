// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { buildFixturePlan } from "./fixtures/billing"
import { planFromApi } from "./api-mapping"
import { billingMode, getBillingContext, getPlan } from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const notConfigured = expect.objectContaining({ kind: "not_configured" })

beforeEach(() => {
  vi.stubEnv("FOODI_BILLING_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => {
  clearPreviewCollections()
  vi.unstubAllEnvs()
})

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("FOODI_BILLING_DATA_SOURCE", "preview")
}

describe("billing data source", () => {
  it("refuses preview data in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview", "PREVIEW", "true"]) {
      vi.stubEnv("FOODI_BILLING_DATA_SOURCE", value)
      expect(billingMode()).toBe("api")
      await expect(getPlan()).rejects.toEqual(notConfigured)
      await expect(getBillingContext()).rejects.toEqual(notConfigured)
    }
  })

  it("ignores every preview scenario in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_BILLING_DATA_SOURCE", "preview")
    for (const scenario of ["empty", "error", "slow", "forbidden", "past_due", "trial", "minimal"]) {
      await expect(getPlan(scenario)).rejects.toEqual(notConfigured)
    }
  })

  it("uses the API (not configured) outside production unless preview is chosen, with no fallback", async () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(billingMode()).toBe("api")
    await expect(getPlan()).rejects.toEqual(notConfigured)
  })
})

describe("preview billing", () => {
  beforeEach(preview)

  it("serves a labelled sample plan with server-style fee terms in every basis", async () => {
    const plan = await getPlan()
    expect(plan).toMatchObject({ id: "prv-plan-01", name: "Preview plan", model: "hybrid", status: "active" })
    expect(plan!.feeTerms.map((term) => term.basis)).toEqual(["per_order", "percentage_of_order", "per_period"])
  })

  it("serves the plan variants as scenarios", async () => {
    expect(await getPlan("past_due")).toMatchObject({ status: "past_due", notice: expect.stringMatching(/Preview notice/) })
    expect(await getPlan("trial")).toMatchObject({ status: "trialing", model: "subscription", renewsOn: null })
    expect(await getPlan("minimal")).toMatchObject({ model: null, status: null, entitlements: [], feeTerms: [], renewsOn: null })
    expect(await getPlan("empty")).toBeNull()
    expect(await getPlan("nonsense")).toMatchObject({ id: "prv-plan-01" })
  })

  it("supports the error and forbidden scenarios", async () => {
    await expect(getPlan("error")).rejects.toEqual(expect.objectContaining({ kind: "unavailable" }))
    await expect(getPlan("forbidden")).rejects.toEqual(expect.objectContaining({ kind: "forbidden" }))
  })
})

describe("preview fixtures", () => {
  it("pass the same strict mapper the API uses, in every variant", () => {
    vi.stubEnv("NODE_ENV", "development")
    for (const variant of ["default", "past_due", "trial", "minimal"] as const) {
      const plan = buildFixturePlan(Date.now(), variant)
      expect(planFromApi(JSON.parse(JSON.stringify(plan)), { currency: "INR" })).toEqual(plan)
    }
  })

  it("hard-code no real fee, percentage or tax: nothing is 10 rupees, 18 percent or GST", () => {
    vi.stubEnv("NODE_ENV", "development")
    const text = JSON.stringify(buildFixturePlan(Date.now()))
    expect(text).not.toMatch(/GST/i)
    expect(text).not.toMatch(/"amountMinor":1000\b/)
    expect(text).not.toMatch(/"rateBasisPoints":1800\b/)
    expect(text).toMatch(/Preview/)
  })
})
