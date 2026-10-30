// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"
import { ServiceError } from "@/lib/data-source/errors"

import { apiReviewsAdapter } from "./api-source"
import { parseReviewListQuery } from "./query"

// The API adapter against a stand-in transport: the requests it sends for the
// PROPOSED contract (docs/reviews-ui.md), and how it treats the responses.
const requests: ApiRequest[] = []
let response: unknown
let failure: Error | null = null
vi.mock("@/lib/api/transport", () => ({
  getApiTransport: () => ({
    request: async (request: ApiRequest) => {
      requests.push(request)
      if (failure) throw failure
      return response
    },
  }),
}))

const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const review = { id: "rev-1", rating: 5, createdAt: "2026-10-27T09:30:00Z" }

beforeEach(() => {
  requests.length = 0
  failure = null
})

describe("reviews over the API (PROPOSED contract)", () => {
  it("asks for the list with the filters and paging, leaving defaults out", async () => {
    response = { items: [review], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }
    await apiReviewsAdapter.list(parseReviewListQuery({}))
    await apiReviewsAdapter.list(parseReviewListQuery({ rating: "2", replied: "unreplied", page: "3" }))
    await apiReviewsAdapter.list(parseReviewListQuery({ replied: "replied" }))
    expect(requests).toEqual([
      { method: "GET", path: "/seller/reviews", query: { rating: undefined, hasReply: undefined, page: 1, pageSize: 10 } },
      { method: "GET", path: "/seller/reviews", query: { rating: 2, hasReply: "false", page: 3, pageSize: 10 } },
      { method: "GET", path: "/seller/reviews", query: { rating: undefined, hasReply: "true", page: 1, pageSize: 10 } },
    ])
  })

  it("maps what comes back, and refuses a malformed list", async () => {
    response = { items: [review], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }
    expect((await apiReviewsAdapter.list(parseReviewListQuery({}))).items[0]).toMatchObject({ id: "rev-1", rating: 5, text: null })
    response = { items: [{ ...review, rating: 6 }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }
    await expect(apiReviewsAdapter.list(parseReviewListQuery({}))).rejects.toMatchObject({ kind: "unavailable" })
  })

  it("gets one review by an encoded id, and treats a 404 as no such review", async () => {
    response = review
    expect(await apiReviewsAdapter.get("rev 1/x")).toMatchObject({ id: "rev-1" })
    expect(requests[0]).toEqual({ method: "GET", path: "/seller/reviews/rev%201%2Fx" })
    failure = new ServiceError("not_found")
    expect(await apiReviewsAdapter.get("rev-404")).toBeNull()
    failure = new ServiceError("forbidden")
    await expect(apiReviewsAdapter.get("rev-1")).rejects.toMatchObject({ kind: "forbidden" })
  })

  it("posts a reply and a report with the idempotency key, and returns the updated review", async () => {
    response = { ...review, reply: { text: "Thanks", repliedAt: "2026-10-27T11:00:00Z" } }
    const replied = await apiReviewsAdapter.act("rev-1", { type: "reply", text: "Thanks" }, KEY)
    expect(replied.reply?.text).toBe("Thanks")
    response = { ...review, report: { reportedAt: "2026-10-27T11:00:00Z", reason: "other", note: "Fake" } }
    await apiReviewsAdapter.act("rev-1", { type: "report_abuse", reason: "other", note: "Fake" }, KEY)
    expect(requests).toEqual([
      { method: "POST", path: "/seller/reviews/rev-1/reply", body: { text: "Thanks" }, idempotencyKey: KEY },
      { method: "POST", path: "/seller/reviews/rev-1/reports", body: { reason: "other", note: "Fake" }, idempotencyKey: KEY },
    ])
  })

  it("never reports a refused or failed action as done", async () => {
    failure = new ServiceError("forbidden")
    await expect(apiReviewsAdapter.act("rev-1", { type: "reply", text: "x" }, KEY)).rejects.toMatchObject({ kind: "forbidden" })
    failure = null
    response = { nonsense: true }
    await expect(apiReviewsAdapter.act("rev-1", { type: "reply", text: "x" }, KEY)).rejects.toMatchObject({ kind: "unavailable" })
  })

  it("reports not_configured with the real transport, so production shows not-connected", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/api/transport")
    const { apiReviewsAdapter: real } = await import("./api-source")
    await expect(real.list(parseReviewListQuery({}))).rejects.toMatchObject({ kind: "not_configured" })
    await expect(real.get("rev-1")).rejects.toMatchObject({ kind: "not_configured" })
    await expect(real.act("rev-1", { type: "reply", text: "x" }, KEY)).rejects.toMatchObject({ kind: "not_configured" })
  })
})
