// @vitest-environment node
import { describe, expect, it } from "vitest"

import { commandBodyToApi, reviewFromApi, reviewListFromApi } from "./api-mapping"

const valid = {
  id: "rev-1",
  rating: 4,
  text: "Lovely.",
  reviewerName: "Meera S.",
  createdAt: "2026-10-27T09:30:00Z",
  reply: null,
  moderation: null,
  report: null,
  order: null,
}
const unavailable = expect.objectContaining({ kind: "unavailable" })

describe("reviewFromApi", () => {
  it("maps a complete review", () => {
    expect(reviewFromApi(valid)).toEqual(valid)
  })

  it("represents a missing text, name, reply, status, report and order explicitly as null", () => {
    expect(reviewFromApi({ id: "rev-2", rating: 5, createdAt: "2026-10-27T09:30:00Z" })).toEqual({
      id: "rev-2",
      rating: 5,
      text: null,
      reviewerName: null,
      createdAt: "2026-10-27T09:30:00Z",
      reply: null,
      moderation: null,
      report: null,
      order: null,
    })
  })

  it.each([1, 2, 3, 4, 5])("accepts rating %d", (rating) => {
    expect(reviewFromApi({ ...valid, rating }).rating).toBe(rating)
  })

  it.each([0, 6, -1, 3.5, "4", null, undefined, NaN, Infinity, true])("refuses rating %j", (rating) => {
    expect(() => reviewFromApi({ ...valid, rating })).toThrow(unavailable)
  })

  it("never reads contact details, so they can't reach the screen (R3)", () => {
    const mapped = reviewFromApi({ ...valid, phone: "+91 98765 43210", email: "meera@example.com", customer: { phone: "1", email: "e@x.com" } })
    expect(JSON.stringify(mapped)).not.toMatch(/98765|example\.com|"phone"|"email"/)
    expect(Object.keys(mapped).sort()).toEqual(Object.keys(valid).sort())
  })

  it("refuses malformed required fields", () => {
    for (const bad of [null, "x", [], 7, {}, { ...valid, id: "" }, { ...valid, id: "a b" }, { ...valid, id: 5 }, { ...valid, createdAt: "yesterday" }, { ...valid, createdAt: 1 }, { ...valid, createdAt: null }]) {
      expect(() => reviewFromApi(bad)).toThrow(unavailable)
    }
  })

  it("refuses an empty or blank text or name instead of turning it into none", () => {
    for (const patch of [{ text: "" }, { text: "   " }, { text: 4 }, { reviewerName: "" }, { reviewerName: " " }, { reviewerName: false }]) {
      expect(() => reviewFromApi({ ...valid, ...patch })).toThrow(unavailable)
    }
  })

  it("accepts the known moderation statuses and refuses unknown ones", () => {
    for (const moderation of ["published", "under_review", "hidden"]) expect(reviewFromApi({ ...valid, moderation }).moderation).toBe(moderation)
    for (const moderation of ["approved", "removed", "", 1, {}]) expect(() => reviewFromApi({ ...valid, moderation })).toThrow(unavailable)
  })

  it("maps a reply, with its publication status only when supplied", () => {
    const reply = { text: "Thank you!", repliedAt: "2026-10-27T11:00:00Z" }
    expect(reviewFromApi({ ...valid, reply }).reply).toEqual({ ...reply, publication: null })
    for (const publication of ["published", "pending_approval", "not_published"]) {
      expect(reviewFromApi({ ...valid, reply: { ...reply, publication } }).reply?.publication).toBe(publication)
    }
  })

  it("refuses a malformed reply", () => {
    const reply = { text: "Thank you!", repliedAt: "2026-10-27T11:00:00Z" }
    for (const bad of ["Thanks", [], { ...reply, text: "" }, { ...reply, text: 1 }, { ...reply, repliedAt: "soon" }, { text: "x" }, { ...reply, publication: "live" }, { ...reply, publication: 3 }]) {
      expect(() => reviewFromApi({ ...valid, reply: bad })).toThrow(unavailable)
    }
  })

  it("maps a report and refuses a malformed one", () => {
    const report = { reportedAt: "2026-10-27T12:00:00Z", reason: "spam_or_fake" }
    expect(reviewFromApi({ ...valid, report }).report).toEqual({ ...report, note: null })
    expect(reviewFromApi({ ...valid, report: { ...report, note: "Fake" } }).report?.note).toBe("Fake")
    for (const bad of ["x", { ...report, reason: "" }, { ...report, reportedAt: "never" }, { reason: "x" }, { ...report, note: "" }]) {
      expect(() => reviewFromApi({ ...valid, report: bad })).toThrow(unavailable)
    }
  })

  it("links an order only for a well-formed reference (R4), and refuses a malformed one rather than inferring", () => {
    expect(reviewFromApi({ ...valid, order: { id: "ord_123", reference: "FD-1042" } }).order).toEqual({ id: "ord_123", reference: "FD-1042" })
    for (const bad of ["ord_1", [], { id: "ord_1" }, { reference: "FD-1" }, { id: "", reference: "FD-1" }, { id: "a/b", reference: "FD-1" }, { id: "ord_1", reference: "" }, { id: "ord_1", reference: "x".repeat(41) }, { id: 5, reference: "FD-1" }]) {
      expect(() => reviewFromApi({ ...valid, order: bad })).toThrow(unavailable)
    }
    // Nothing in the order field means no link: it is never worked out from anything else.
    expect(reviewFromApi({ ...valid, orderId: "ord_1" }).order).toBeNull()
  })
})

describe("reviewListFromApi", () => {
  const page = { items: [valid], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }

  it("maps a page of reviews", () => {
    expect(reviewListFromApi(page)).toEqual(page)
    expect(reviewListFromApi({ ...page, items: [], totalItems: 0 }).items).toEqual([])
  })

  it("fails visibly when one review is malformed, instead of dropping it", () => {
    expect(() => reviewListFromApi({ ...page, items: [valid, { ...valid, rating: 9 }], totalItems: 2 })).toThrow(unavailable)
  })

  it("refuses malformed paging", () => {
    for (const patch of [{ items: "x" }, { page: 0 }, { page: 1.5 }, { pageSize: 0 }, { totalItems: -1 }, { totalPages: 0 }, { totalItems: "1" }, { items: [valid, valid], pageSize: 1, totalItems: 2 }, { totalItems: 0 }]) {
      expect(() => reviewListFromApi({ ...page, ...patch })).toThrow(unavailable)
    }
    expect(() => reviewListFromApi(null)).toThrow(unavailable)
  })
})

describe("commandBodyToApi", () => {
  it("sends only what the command carries", () => {
    expect(commandBodyToApi({ type: "reply", text: "Thanks" })).toEqual({ text: "Thanks" })
    expect(commandBodyToApi({ type: "report_abuse", reason: "other", note: "Fake" })).toEqual({ reason: "other", note: "Fake" })
    expect(commandBodyToApi({ type: "report_abuse", reason: "spam_or_fake", note: "" })).toEqual({ reason: "spam_or_fake", note: null })
  })
})
