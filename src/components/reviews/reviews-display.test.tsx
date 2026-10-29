import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"
import { parseReviewListQuery } from "@/lib/reviews/query"
import type { Review, ReviewListResult } from "@/lib/reviews/types"

import { ReviewDetail } from "./review-detail"
import { ReviewsList } from "./reviews-list"
import { ReviewsPagination } from "./reviews-pagination"
import { ReviewsLoadFailure, ReviewsNoResults } from "./reviews-states"
import { ReviewsToolbar } from "./reviews-toolbar"

// The reply and report controls are covered in reviews-actions.test.tsx.
vi.mock("@/app/(dashboard)/reviews/actions", () => ({ runReviewCommand: vi.fn() }))
vi.mock("@/components/shared/notifications", () => ({ notifyActionResult: vi.fn() }))

const context = { timeZone: "Asia/Kolkata", locale: "en-IN" }
const review = (overrides: Partial<Review> = {}): Review => ({
  id: "rev-1",
  rating: 4,
  text: "Good portions.",
  reviewerName: "Meera S.",
  createdAt: "2026-10-27T09:30:00Z",
  reply: null,
  moderation: null,
  report: null,
  order: null,
  ...overrides,
})
const defaultQuery = parseReviewListQuery({})

describe("ReviewsList", () => {
  const renderList = (reviews: Review[], query = defaultQuery) =>
    render(<ReviewsList reviews={reviews} query={query} context={context} />)
  // The table and the cards are both rendered (CSS picks one), so check either.
  const table = () => screen.getByRole("table")

  it("shows rating, text, reviewer, date and reply status, with an accessible rating", () => {
    renderList([review()])
    const row = within(table()).getAllByRole("row")[1]
    expect(within(row).getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument()
    expect(within(row).getByText("Good portions.")).toBeInTheDocument()
    expect(within(row).getByText("Meera S.")).toBeInTheDocument()
    expect(within(row).getByText("27 Oct 2026")).toBeInTheDocument()
    expect(within(row).getByText("Not replied")).toBeInTheDocument()
  })

  it("says so for a rating-only review instead of showing an empty row (R2)", () => {
    renderList([review({ text: null, rating: 5 })])
    expect(within(table()).getByText("Rating only, no written review")).toBeInTheDocument()
    expect(within(table()).getByRole("img", { name: "5 out of 5 stars" })).toBeInTheDocument()
    expect(within(table()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/reviews/rev-1"])
  })

  it("shows 'Name not shared' without a name, and never a contact detail (R3)", () => {
    renderList([review({ reviewerName: null })])
    expect(within(table()).getByText("Name not shared")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@|\+\d{2}|\d{10}/)
  })

  it("shows the date in the restaurant's time zone, not UTC", () => {
    // 20:00 UTC on the 27th is 01:30 on the 28th in Kolkata.
    renderList([review({ createdAt: "2026-10-27T20:00:00Z" })])
    expect(within(table()).getByText("28 Oct 2026")).toBeInTheDocument()
    expect(within(table()).getByText("28 Oct 2026").closest("time")).toHaveAttribute("datetime", "2026-10-27T20:00:00Z")
  })

  it("shows a moderation status only when the source supplied one (R7)", () => {
    const { unmount } = renderList([review()])
    expect(within(table()).queryByText(/Published|Under review|Hidden/)).not.toBeInTheDocument()
    unmount()
    renderList([review({ moderation: "under_review" })])
    expect(within(table()).getByText("Under review by Foodi")).toBeInTheDocument()
  })

  it("shows replied reviews as replied, and a report as a fact, not an outcome", () => {
    renderList([
      review({ id: "rev-2", reply: { text: "Thanks", repliedAt: "2026-10-27T11:00:00Z", publication: null } }),
      review({ id: "rev-3", report: { reportedAt: "2026-10-27T12:00:00Z", reason: "spam_or_fake", note: null } }),
    ])
    expect(within(table()).getByText("Replied")).toBeInTheDocument()
    expect(within(table()).getByText("You reported this")).toBeInTheDocument()
    expect(within(table()).queryByText(/removed|hidden|investigat/i)).not.toBeInTheDocument()
  })

  it("links each review to its detail page, carrying the list's filters", () => {
    renderList([review({ id: "rev-9" })], parseReviewListQuery({ rating: "4", replied: "unreplied", page: "2" }))
    expect(screen.getByRole("link", { name: "View review by Meera S." })).toHaveAttribute("href", "/reviews/rev-9?rating=4&replied=unreplied&page=2")
  })

  it("renders the same reviews as table rows and as cards", () => {
    renderList([review({ id: "a" }), review({ id: "b" })])
    expect(within(table()).getAllByRole("row")).toHaveLength(3)
    expect(screen.getAllByRole("list").flatMap((list) => within(list).getAllByRole("listitem"))).toHaveLength(2)
  })
})

describe("ReviewDetail", () => {
  const renderDetail = (overrides: Partial<Review> = {}) => render(<ReviewDetail review={review(overrides)} context={context} />)

  it("shows the full text, reviewer, rating and date", () => {
    renderDetail({ text: "Line one.\nLine two." })
    expect(screen.getByRole("heading", { level: 1, name: "Review by Meera S." })).toBeInTheDocument()
    expect(screen.getByText(/Line one\./)).toBeInTheDocument()
    expect(screen.getAllByRole("img", { name: "4 out of 5 stars" }).length).toBeGreaterThan(0)
    expect(screen.getByText("27 Oct, 3:00 pm")).toBeInTheDocument()
  })

  it("handles a rating-only review without an empty block", () => {
    renderDetail({ text: null })
    expect(screen.getByText("Rating only, no written review")).toBeInTheDocument()
  })

  it("links an order only when the review carries an order reference (R4)", () => {
    const { unmount } = renderDetail()
    expect(screen.getByText("Not linked to an order")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Order/ })).not.toBeInTheDocument()
    unmount()
    renderDetail({ order: { id: "prv-1016", reference: "PRV-1016" } })
    expect(screen.getByRole("link", { name: "Order PRV-1016" })).toHaveAttribute("href", "/orders/prv-1016")
    expect(screen.queryByText("Not linked to an order")).not.toBeInTheDocument()
  })

  it("names the reviewer by display name only, with a fallback when it isn't shared (R3)", () => {
    renderDetail({ reviewerName: null })
    expect(screen.getByRole("heading", { level: 1, name: "Review by a customer" })).toBeInTheDocument()
    expect(screen.getByText("Name not shared")).toBeInTheDocument()
  })

  it("shows a moderation status only when the source supplied one (R7)", () => {
    const { unmount } = renderDetail()
    expect(screen.queryByText(/Under review|Hidden from customers|^Published$/)).not.toBeInTheDocument()
    unmount()
    renderDetail({ moderation: "hidden" })
    expect(screen.getByText("Hidden from customers")).toBeInTheDocument()
  })

  it("offers a reply and a report on a fresh review, and neither again once they exist", () => {
    const { unmount } = renderDetail()
    expect(screen.getByRole("textbox", { name: "Write a reply" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Report abuse" })).toBeInTheDocument()
    unmount()
    renderDetail({
      reply: { text: "Thanks", repliedAt: "2026-10-27T11:00:00Z", publication: null },
      report: { reportedAt: "2026-10-27T12:00:00Z", reason: "other", note: "Fake" },
    })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Send reply|Report abuse/ })).not.toBeInTheDocument()
    expect(screen.getAllByText("Replied").length).toBeGreaterThan(0)
  })
})

describe("ReviewsToolbar", () => {
  const hrefs = (nav: string) => within(screen.getByRole("navigation", { name: nav })).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])

  it("filters by rating and reply status with plain links, returning to page 1", () => {
    render(<ReviewsToolbar query={parseReviewListQuery({ rating: "3", replied: "unreplied", page: "4" })} />)
    expect(hrefs("Filter reviews by rating")).toEqual([
      ["All ratings", "/reviews?replied=unreplied"],
      ["5 stars", "/reviews?rating=5&replied=unreplied"],
      ["4 stars", "/reviews?rating=4&replied=unreplied"],
      ["3 stars", "/reviews?rating=3&replied=unreplied"],
      ["2 stars", "/reviews?rating=2&replied=unreplied"],
      ["1 star", "/reviews?rating=1&replied=unreplied"],
    ])
    expect(hrefs("Filter reviews by reply status")).toEqual([
      ["All", "/reviews?rating=3"],
      ["Replied", "/reviews?rating=3&replied=replied"],
      ["Not replied", "/reviews?rating=3&replied=unreplied"],
    ])
  })

  it("marks the current filters and offers a reset only when one is active", () => {
    const { unmount } = render(<ReviewsToolbar query={parseReviewListQuery({})} />)
    expect(screen.queryByRole("link", { name: "Reset filters" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "All ratings" })).toHaveAttribute("aria-current", "page")
    unmount()
    render(<ReviewsToolbar query={parseReviewListQuery({ rating: "2" })} />)
    expect(screen.getByRole("link", { name: "2 stars" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "All ratings" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("link", { name: "Reset filters" })).toHaveAttribute("href", "/reviews")
  })
})

describe("ReviewsPagination", () => {
  const result = (page: number): ReviewListResult => ({ items: Array.from({ length: page === 3 ? 8 : 10 }, (_, i) => review({ id: `r${i}` })), page, pageSize: 10, totalItems: 28, totalPages: 3 })

  it("shows the range, and links previous and next with the filters kept", () => {
    render(<ReviewsPagination query={parseReviewListQuery({ rating: "5", page: "2" })} result={result(2)} />)
    expect(screen.getByText("Showing 11–20 of 28 reviews")).toBeInTheDocument()
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/reviews?rating=5")
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/reviews?rating=5&page=3")
  })

  it("disables previous on the first page and next on the last", () => {
    const { unmount } = render(<ReviewsPagination query={parseReviewListQuery({})} result={result(1)} />)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/reviews?page=2")
    unmount()
    render(<ReviewsPagination query={parseReviewListQuery({ page: "3" })} result={result(3)} />)
    expect(screen.getByText("Showing 21–28 of 28 reviews")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })
})

describe("load failures", () => {
  it("says reviews aren't connected for a missing API, with nothing else to act on", () => {
    render(<ReviewsLoadFailure error={new ServiceError("not_configured")} retryHref="/reviews" />)
    expect(screen.getByText("Reviews aren't connected yet")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows a permission refusal as an alert, with no retry", () => {
    render(<ReviewsLoadFailure error={new ServiceError("forbidden")} retryHref="/reviews" />)
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to see or answer reviews")
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows any other failure as an alert with a retry that keeps the filters", () => {
    render(<ReviewsLoadFailure error={new Error("boom")} retryHref="/reviews?rating=5" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load reviews")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/reviews?rating=5")
  })

  it("offers a reset when filters match nothing", () => {
    render(<ReviewsNoResults />)
    expect(screen.getByText("No reviews match these filters")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reset filters" })).toHaveAttribute("href", "/reviews")
  })
})
