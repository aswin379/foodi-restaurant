// @vitest-environment node
import { describe, expect, it } from "vitest"

import { hasActiveReviewFilters, parseReviewListQuery, REVIEWS_PAGE_SIZE, reviewHref, reviewsHref } from "./query"

const defaults = { rating: "all", replied: "all", page: 1, pageSize: REVIEWS_PAGE_SIZE }

describe("parseReviewListQuery", () => {
  it("uses the defaults for an empty URL", () => {
    expect(parseReviewListQuery({})).toEqual(defaults)
  })

  it("reads valid ratings, reply statuses and pages", () => {
    expect(parseReviewListQuery({ rating: "4", replied: "unreplied", page: "3" })).toEqual({
      ...defaults,
      rating: 4,
      replied: "unreplied",
      page: 3,
    })
    expect(parseReviewListQuery({ replied: "replied" }).replied).toBe("replied")
  })

  it.each(["0", "6", "-1", "3.5", "03", "5abc", " 5", "five", "", "NaN", "１"])("falls back to all ratings for %j", (rating) => {
    expect(parseReviewListQuery({ rating }).rating).toBe("all")
  })

  it.each(["Replied", "yes", "true", "all", "", "replied,unreplied"])("falls back to all reply statuses for %j", (replied) => {
    expect(parseReviewListQuery({ replied }).replied).toBe("all")
  })

  it.each(["0", "-2", "1.5", "2abc", "abc", "", "9999999", "1e3"])("falls back to page 1 for %j", (page) => {
    expect(parseReviewListQuery({ page }).page).toBe(1)
  })

  it("takes the first value of a repeated parameter, like the other lists", () => {
    expect(parseReviewListQuery({ rating: ["2", "5"], replied: ["replied", "x"], page: ["2", "9"] })).toMatchObject({
      rating: 2,
      replied: "replied",
      page: 2,
    })
  })

  it("ignores unrelated parameters, including preview scenarios", () => {
    expect(parseReviewListQuery({ preview: "forbidden", q: "x" })).toEqual(defaults)
  })
})

describe("reviewsHref and reviewHref", () => {
  it("leaves defaults out and orders parameters consistently", () => {
    expect(reviewsHref({ rating: "all", replied: "all", page: 1 })).toBe("/reviews")
    expect(reviewsHref({ rating: 5, replied: "unreplied", page: 2 })).toBe("/reviews?rating=5&replied=unreplied&page=2")
  })

  it("applies overrides, and a new filter can return to page 1", () => {
    const query = { rating: 5 as const, replied: "all" as const, page: 3 }
    expect(reviewsHref(query, { page: 4 })).toBe("/reviews?rating=5&page=4")
    expect(reviewsHref(query, { replied: "replied", page: 1 })).toBe("/reviews?rating=5&replied=replied")
  })

  it("round-trips through the parser", () => {
    const query = { rating: 2 as const, replied: "unreplied" as const, page: 3 }
    const url = new URL(reviewsHref(query), "http://x")
    expect(parseReviewListQuery(Object.fromEntries(url.searchParams))).toMatchObject(query)
  })

  it("carries the list's filters to the detail page, with the id encoded", () => {
    expect(reviewHref("prv-rev-001", { rating: "all", replied: "all", page: 1 })).toBe("/reviews/prv-rev-001")
    expect(reviewHref("a b/c", { rating: 3, replied: "replied", page: 2 })).toBe("/reviews/a%20b%2Fc?rating=3&replied=replied&page=2")
  })

  it("knows when a filter is active (the page alone isn't a filter)", () => {
    expect(hasActiveReviewFilters({ rating: "all", replied: "all" })).toBe(false)
    expect(hasActiveReviewFilters({ rating: 1, replied: "all" })).toBe(true)
    expect(hasActiveReviewFilters({ rating: "all", replied: "replied" })).toBe(true)
  })
})
