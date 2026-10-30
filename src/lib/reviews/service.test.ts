// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"
import { getWeeklyHours } from "@/lib/hours/service"
import { listMenuItems } from "@/lib/menu/service"
import { parseMenuItemListQuery } from "@/lib/menu/query"
import { buildFixtureOrders } from "@/lib/orders/fixtures/orders"
import { getOrderBoard, listOrders } from "@/lib/orders/service"
import { parseOrderListQuery } from "@/lib/orders/query"

import { buildFixtureReviews } from "./fixtures/reviews"
import { parseReviewListQuery, REVIEWS_PAGE_SIZE } from "./query"
import {
  getReview,
  getReviewsContext,
  listReviews,
  performReviewCommand,
  resetReviewsPreview,
  reviewsMode,
  reviewsPreviewRefusesActions,
  setReviewsPreviewActionRefusal,
} from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const OTHER_KEY = "2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const THIRD_KEY = "3d9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const query = (params: Record<string, string> = {}) => parseReviewListQuery(params)
const notConfigured = expect.objectContaining({ kind: "not_configured" })

beforeEach(() => {
  vi.stubEnv("FOODI_REVIEWS_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => {
  clearPreviewCollections()
  vi.unstubAllEnvs()
})

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("FOODI_REVIEWS_DATA_SOURCE", "preview")
}

describe("reviews data source", () => {
  it("refuses preview data in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview", "PREVIEW", "true"]) {
      vi.stubEnv("FOODI_REVIEWS_DATA_SOURCE", value)
      expect(reviewsMode()).toBe("api")
      await expect(listReviews(query())).rejects.toEqual(notConfigured)
      await expect(getReview("prv-rev-001")).rejects.toEqual(notConfigured)
      await expect(getReviewsContext()).rejects.toEqual(notConfigured)
    }
  })

  it("ignores preview scenarios in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_REVIEWS_DATA_SOURCE", "preview")
    for (const scenario of ["empty", "error", "slow", "forbidden"]) {
      await expect(listReviews(query(), scenario)).rejects.toEqual(notConfigured)
      await expect(getReview("prv-rev-001", scenario)).rejects.toEqual(notConfigured)
    }
  })

  it("never applies a reply or report against preview data in production, and refuses the preview tools", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_REVIEWS_DATA_SOURCE", "preview")
    await expect(performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, KEY)).rejects.toEqual(notConfigured)
    await expect(performReviewCommand("prv-rev-009", { type: "report_abuse", reason: "spam_or_fake", note: "" }, KEY)).rejects.toEqual(notConfigured)
    await expect(resetReviewsPreview()).rejects.toMatchObject({ kind: "forbidden" })
    await expect(setReviewsPreviewActionRefusal(true)).rejects.toMatchObject({ kind: "forbidden" })
    expect(() => reviewsPreviewRefusesActions()).toThrow(expect.objectContaining({ kind: "forbidden" }))
  })

  it("doesn't fall back to preview data when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(reviewsMode()).toBe("api")
    await expect(listReviews(query())).rejects.toEqual(notConfigured)
    await expect(getReview("prv-rev-001")).rejects.toEqual(notConfigured)
    await expect(resetReviewsPreview()).rejects.toMatchObject({ kind: "forbidden" })
  })
})

describe("preview reviews", () => {
  it("lists newest first, ten to a page, with the total", async () => {
    preview()
    const first = await listReviews(query())
    expect(first).toMatchObject({ page: 1, pageSize: REVIEWS_PAGE_SIZE, totalItems: 28, totalPages: 3 })
    expect(first.items).toHaveLength(10)
    const all = [...first.items, ...(await listReviews(query({ page: "2" }))).items, ...(await listReviews(query({ page: "3" }))).items]
    expect(all).toHaveLength(28)
    expect(new Set(all.map((review) => review.id)).size).toBe(28)
    const times = all.map((review) => review.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect((await listReviews(query({ page: "3" }))).items).toHaveLength(8)
  })

  it("clamps a page past the end to the last page", async () => {
    preview()
    expect(await listReviews(query({ page: "99" }))).toMatchObject({ page: 3, totalPages: 3 })
  })

  it("filters by rating and by reply status, together", async () => {
    preview()
    const fives = await listReviews(query({ rating: "5" }))
    expect(fives.items.length).toBe(fives.totalItems)
    expect(fives.items.every((review) => review.rating === 5)).toBe(true)
    const replied = await listReviews(query({ replied: "replied" }))
    expect(replied.items.every((review) => review.reply !== null)).toBe(true)
    const unreplied = await listReviews(query({ replied: "unreplied" }))
    expect(unreplied.items.every((review) => review.reply === null)).toBe(true)
    expect(replied.totalItems + unreplied.totalItems).toBe(28)
    const both = await listReviews(query({ rating: "5", replied: "unreplied" }))
    expect(both.items.every((review) => review.rating === 5 && review.reply === null)).toBe(true)
    expect(both.totalItems).toBeGreaterThan(0)
    expect(both.totalItems).toBeLessThan(fives.totalItems)
  })

  it("has a sample for each state the screens handle", async () => {
    preview()
    const all = buildFixtureReviews(Date.now())
    expect(all.some((review) => review.text === null)).toBe(true)
    expect(all.some((review) => review.reviewerName === null)).toBe(true)
    expect(all.some((review) => review.order !== null)).toBe(true)
    expect(all.some((review) => review.order === null)).toBe(true)
    expect(all.some((review) => review.moderation !== null)).toBe(true)
    expect(all.some((review) => review.moderation === null)).toBe(true)
    expect(all.some((review) => review.reply?.publication)).toBe(true)
    expect(all.some((review) => review.reply && review.reply.publication === null)).toBe(true)
    expect(all.some((review) => review.report !== null)).toBe(true)
    for (const rating of [1, 2, 3, 4, 5]) expect(all.some((review) => review.rating === rating)).toBe(true)
  })

  it("holds no contact details, only display names", () => {
    expect(JSON.stringify(buildFixtureReviews(Date.now()))).not.toMatch(/@|\+\d|\d{10}|phone|email/i)
  })

  it("links only to completed sample orders that exist in the orders preview", () => {
    const orders = new Map(buildFixtureOrders(Date.now()).map((order) => [order.id, order]))
    for (const review of buildFixtureReviews(Date.now())) {
      if (!review.order) continue
      const order = orders.get(review.order.id)
      expect(order, review.order.id).toBeDefined()
      expect(order?.reference).toBe(review.order.reference)
      expect(order?.status).toBe("completed")
    }
  })

  it("shows the scenarios: empty, error, forbidden", async () => {
    preview()
    expect((await listReviews(query(), "empty")).totalItems).toBe(0)
    await expect(listReviews(query(), "error")).rejects.toMatchObject({ kind: "unavailable" })
    await expect(listReviews(query(), "forbidden")).rejects.toMatchObject({ kind: "forbidden" })
    await expect(getReview("prv-rev-001", "forbidden")).rejects.toMatchObject({ kind: "forbidden" })
    expect(await getReview("prv-rev-001", "empty")).toBeNull()
  })

  it("returns null for an unknown review instead of another one", async () => {
    preview()
    expect(await getReview("prv-rev-999")).toBeNull()
    expect(await getReview("")).toBeNull()
  })

  it("uses the shared restaurant context's time zone", async () => {
    preview()
    expect(await getReviewsContext()).toMatchObject({ timeZone: "Asia/Kolkata", currency: "INR", locale: "en-IN" })
  })
})

describe("preview replies and reports", () => {
  it("records a reply once, and refuses a second one with a different key", async () => {
    preview()
    const updated = await performReviewCommand("prv-rev-005", { type: "reply", text: "Thank you!" }, KEY)
    expect(updated.reply).toMatchObject({ text: "Thank you!", publication: null })
    expect((await getReview("prv-rev-005"))?.reply?.text).toBe("Thank you!")
    await expect(performReviewCommand("prv-rev-005", { type: "reply", text: "Again" }, OTHER_KEY)).rejects.toMatchObject({
      kind: "conflict",
      userMessage: expect.stringContaining("already has a reply"),
    })
    expect((await getReview("prv-rev-005"))?.reply?.text).toBe("Thank you!")
  })

  it("replays a repeated key with the stored result instead of applying it twice", async () => {
    preview()
    const first = await performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, KEY)
    const again = await performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, KEY)
    expect(again).toEqual(first)
    const report = await performReviewCommand("prv-rev-009", { type: "report_abuse", reason: "spam_or_fake", note: "" }, OTHER_KEY)
    expect(await performReviewCommand("prv-rev-009", { type: "report_abuse", reason: "spam_or_fake", note: "" }, OTHER_KEY)).toEqual(report)
  })

  it("refuses a key reused for a different request", async () => {
    preview()
    await performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, KEY)
    await expect(performReviewCommand("prv-rev-005", { type: "reply", text: "Something else" }, KEY)).rejects.toMatchObject({ kind: "conflict" })
    await expect(performReviewCommand("prv-rev-008", { type: "reply", text: "Thanks" }, KEY)).rejects.toMatchObject({ kind: "conflict" })
  })

  it("records a report, keeps the review in the list and unchanged otherwise, and refuses a second report", async () => {
    preview()
    const before = await getReview("prv-rev-009")
    const total = (await listReviews(query())).totalItems
    const updated = await performReviewCommand("prv-rev-009", { type: "report_abuse", reason: "other", note: "Looks fake" }, KEY)
    expect(updated.report).toMatchObject({ reason: "other", note: "Looks fake" })
    expect(updated).toMatchObject({ rating: before!.rating, text: before!.text, moderation: null, reply: null })
    expect((await listReviews(query())).totalItems).toBe(total)
    await expect(performReviewCommand("prv-rev-009", { type: "report_abuse", reason: "spam_or_fake", note: "" }, OTHER_KEY)).rejects.toMatchObject({
      kind: "conflict",
      userMessage: "You've already reported this review.",
    })
  })

  it("reports an unknown review as not found", async () => {
    preview()
    await expect(performReviewCommand("prv-rev-999", { type: "reply", text: "x" }, KEY)).rejects.toMatchObject({ kind: "not_found" })
  })

  it("refuses replies and reports as for a non-owner when the preview tool is on, changing nothing", async () => {
    preview()
    await setReviewsPreviewActionRefusal(true)
    expect(reviewsPreviewRefusesActions()).toBe(true)
    await expect(performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, KEY)).rejects.toMatchObject({ kind: "forbidden" })
    await expect(performReviewCommand("prv-rev-009", { type: "report_abuse", reason: "spam_or_fake", note: "" }, OTHER_KEY)).rejects.toMatchObject({ kind: "forbidden" })
    expect((await getReview("prv-rev-005"))?.reply).toBeNull()
    expect((await getReview("prv-rev-009"))?.report).toBeNull()
    await setReviewsPreviewActionRefusal(false)
    expect(reviewsPreviewRefusesActions()).toBe(false)
    await expect(performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, THIRD_KEY)).resolves.toMatchObject({ reply: { text: "Thanks" } })
  })

  it("resets to the starting sample reviews, clearing replies, reports, replayed keys and the refusal tool", async () => {
    preview()
    const initial = await listReviews(query({ page: "1" }))
    await performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, KEY)
    await setReviewsPreviewActionRefusal(true)
    await resetReviewsPreview()
    expect(reviewsPreviewRefusesActions()).toBe(false)
    expect((await getReview("prv-rev-005"))?.reply).toBeNull()
    // The key can be used again, because the replay record was cleared too.
    await expect(performReviewCommand("prv-rev-005", { type: "reply", text: "Different" }, KEY)).resolves.toMatchObject({ reply: { text: "Different" } })
    await resetReviewsPreview()
    expect((await listReviews(query({ page: "1" }))).items.map((review) => review.id)).toEqual(initial.items.map((review) => review.id))
  })

  it("never touches orders, menu or hours data", async () => {
    vi.stubEnv("NODE_ENV", "development")
    for (const name of ["FOODI_REVIEWS_DATA_SOURCE", "FOODI_ORDERS_DATA_SOURCE", "FOODI_MENU_DATA_SOURCE", "FOODI_HOURS_DATA_SOURCE", "FOODI_RESTAURANT_DATA_SOURCE"]) {
      vi.stubEnv(name, "preview")
    }
    const orderQuery = { ...parseOrderListQuery({}), pageSize: 100 }
    const menuQuery = { ...parseMenuItemListQuery({}), pageSize: 100 }
    const orders = await listOrders(orderQuery)
    const board = await getOrderBoard()
    const menu = await listMenuItems(menuQuery)
    const weekly = await getWeeklyHours()

    await performReviewCommand("prv-rev-007", { type: "report_abuse", reason: "other", note: "x" }, KEY)
    await performReviewCommand("prv-rev-005", { type: "reply", text: "Thanks" }, OTHER_KEY)
    await resetReviewsPreview()

    expect(await listOrders(orderQuery)).toEqual(orders)
    expect(await getOrderBoard()).toEqual(board)
    expect(await listMenuItems(menuQuery)).toEqual(menu)
    expect(await getWeeklyHours()).toEqual(weekly)
  })
})
