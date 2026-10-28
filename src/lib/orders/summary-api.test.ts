// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import { apiOrdersAdapter } from "./api-source"
import { ORDER_STATUSES } from "./types"

// The API adapter against a stand-in transport: the request it sends for the
// PROPOSED summary endpoint, and how it treats the response.
const requests: ApiRequest[] = []
let response: unknown
vi.mock("@/lib/api/transport", () => ({
  getApiTransport: () => ({
    request: async (request: ApiRequest) => {
      requests.push(request)
      return response
    },
  }),
}))

beforeEach(() => {
  requests.length = 0
  // The restaurant context has no API yet; its preview values stand in for the session's.
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("FOODI_RESTAURANT_DATA_SOURCE", "preview")
})

const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 1]))

describe("orders day summary over the API (PROPOSED contract)", () => {
  it("asks for the restaurant-local date and returns the server's counts", async () => {
    response = { date: "2026-10-28", timeZone: PREVIEW_RESTAURANT.timeZone, countsByStatus: counts, asOf: "2026-10-28T06:00:00Z" }
    const summary = await apiOrdersAdapter.daySummary("2026-10-28")
    expect(requests).toEqual([{ method: "GET", path: "/seller/orders/summary", query: { date: "2026-10-28" } }])
    expect(summary).toMatchObject({ source: "server", countsByStatus: counts })
  })

  it("refuses a summary for another day or zone instead of showing it as today's", async () => {
    response = { date: "2026-10-27", timeZone: PREVIEW_RESTAURANT.timeZone, countsByStatus: counts, asOf: "2026-10-28T06:00:00Z" }
    await expect(apiOrdersAdapter.daySummary("2026-10-28")).rejects.toMatchObject({ kind: "unavailable" })
    response = { date: "2026-10-28", timeZone: "UTC", countsByStatus: counts, asOf: "2026-10-28T06:00:00Z" }
    await expect(apiOrdersAdapter.daySummary("2026-10-28")).rejects.toMatchObject({ kind: "unavailable" })
  })
})
