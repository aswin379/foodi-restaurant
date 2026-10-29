import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"
import { parsePromotionListQuery } from "@/lib/promotions/query"
import type { Promotion } from "@/lib/promotions/types"

import { PromotionDetail, PromotionDisclaimer, PromotionHeading } from "./promotion-detail"
import { discountText, formatRate } from "./promotion-values"
import { PromotionsList } from "./promotions-list"
import { PromotionsPagination } from "./promotions-pagination"
import { PromotionsLoadFailure, PromotionsNoResults } from "./promotions-states"
import { PromotionsToolbar } from "./promotions-toolbar"

const context = { timeZone: "Asia/Kolkata", locale: "en-IN" }
const inr = (amountMinor: number) => ({ amountMinor, currency: "INR" })
const promotion = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: "promo_1",
  kind: "coupon",
  code: "PREVIEW-TEST1",
  name: "Test coupon",
  status: "active",
  discount: { type: "percentage", rateBasisPoints: 1234, maxDiscount: inr(5555) },
  minimumOrder: inr(11100),
  startsAt: "2026-10-01T04:00:00Z",
  endsAt: "2026-11-01T04:00:00Z",
  orderTypes: ["delivery", "takeaway"],
  appliesTo: ["subtotal", "packaging_fee"],
  fundedBy: "shared",
  managedBy: "foodi",
  stackable: false,
  usageLimit: 100,
  perCustomerLimit: 2,
  redemptionCount: 7,
  ...overrides,
})
const bare = (overrides: Partial<Promotion> = {}): Promotion =>
  promotion({
    name: null,
    status: null,
    discount: { type: "fixed_amount", amount: inr(111) },
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
    ...overrides,
  })
const defaultQuery = parsePromotionListQuery({})

describe("PromotionsList", () => {
  const renderList = (promotions: Promotion[], query = defaultQuery) =>
    render(<PromotionsList promotions={promotions} query={query} context={context} />)
  const firstRow = () => screen.getByRole("table").querySelector("tbody tr") as HTMLElement

  it("shows the code, name, value, validity, status and redemptions as supplied", () => {
    renderList([promotion()])
    const row = firstRow()
    expect(within(row).getByText("PREVIEW-TEST1")).toBeInTheDocument()
    expect(within(row).getByText("Test coupon")).toBeInTheDocument()
    expect(within(row).getByText("12.34% off")).toBeInTheDocument()
    expect(within(row).getByText("Active")).toBeInTheDocument()
    expect(within(row).getByText("7")).toBeInTheDocument()
    expect(row).toHaveTextContent(/1 Oct 2026.*1 Nov 2026/)
  })

  it("shows a fixed amount as given", () => {
    renderList([promotion({ discount: { type: "fixed_amount", amount: inr(2222) } })])
    expect(within(firstRow()).getByText(/₹22\.22 off/)).toBeInTheDocument()
  })

  it("shows a missing status, validity and count as unavailable, never as a guess", () => {
    renderList([bare()])
    expect(within(firstRow()).getAllByText("Not available")).toHaveLength(3)
    expect(firstRow()).not.toHaveTextContent(/active|expired|scheduled|never expires|no expiry|0$/i)
  })

  it("keeps a real zero redemption count as zero", () => {
    renderList([promotion({ redemptionCount: 0 })])
    expect(within(firstRow()).getByText("0")).toBeInTheDocument()
  })

  it("does not work out a status from the dates: a coupon that ended long ago keeps the status given", () => {
    renderList([promotion({ status: "active", startsAt: "2000-01-01T00:00:00Z", endsAt: "2000-02-01T00:00:00Z" })])
    expect(within(firstRow()).getByText("Active")).toBeInTheDocument()
    renderList([promotion({ status: null, startsAt: "2000-01-01T00:00:00Z", endsAt: "2000-02-01T00:00:00Z" })])
    expect(screen.queryByText("Expired")).toBeNull()
  })

  it("says only what a half-given validity says", () => {
    const { rerender } = render(<PromotionsList promotions={[promotion({ endsAt: null })]} query={defaultQuery} context={context} />)
    expect(firstRow()).toHaveTextContent(/From 1 Oct 2026/)
    expect(firstRow()).not.toHaveTextContent(/until|–/i)
    rerender(<PromotionsList promotions={[promotion({ startsAt: null })]} query={defaultQuery} context={context} />)
    expect(firstRow()).toHaveTextContent(/Until 1 Nov 2026/)
  })

  it("links each coupon by id to its detail, carrying the filter and page", () => {
    renderList([promotion()], parsePromotionListQuery({ status: "paused", page: "2" }))
    const links = screen.getAllByRole("link", { name: /PREVIEW-TEST1/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute("href", "/promotions/promo_1?status=paused&page=2")
  })

  it("offers no create, edit, delete, activate, pause or redeem control", () => {
    const { container } = renderList([promotion()])
    expect(screen.queryByRole("button")).toBeNull()
    expect(container).not.toHaveTextContent(/create|new coupon|edit|delete|activate|pause coupon|resume|redeem|apply coupon|copy|share|send|campaign/i)
  })
})

describe("PromotionDetail", () => {
  const renderDetail = (value: Promotion) => render(<PromotionDetail promotion={value} context={context} />)
  const field = (label: string) => screen.getByText(label, { selector: "dt" }).closest("dl") as HTMLElement

  it("shows every supplied field as given", () => {
    renderDetail(promotion())
    expect(field("Status")).toHaveTextContent("Active")
    expect(field("Managed by")).toHaveTextContent("Foodi")
    expect(field("Funded by")).toHaveTextContent("Shared between your restaurant and Foodi")
    expect(field("Value")).toHaveTextContent("12.34% off")
    expect(field("Maximum discount")).toHaveTextContent(/₹55\.55/)
    expect(field("Minimum order")).toHaveTextContent(/₹111\.00/)
    expect(field("Applies to")).toHaveTextContent("Item subtotal, Packaging fee")
    expect(field("Order types")).toHaveTextContent("Delivery, Takeaway")
    expect(field("Can be combined with other promotions")).toHaveTextContent("No")
    expect(field("Limit per customer")).toHaveTextContent("2")
    expect(field("Total usage limit")).toHaveTextContent("100")
    expect(field("Redemptions")).toHaveTextContent("7")
    expect(field("Starts")).toHaveTextContent("1 Oct 2026")
    expect(field("Ends")).toHaveTextContent("1 Nov 2026")
  })

  it("shows every missing value as unavailable and assumes nothing: no funding, no components, no order types", () => {
    renderDetail(bare())
    for (const label of [
      "Status", "Name", "Managed by", "Funded by", "Minimum order", "Applies to", "Starts", "Ends",
      "Order types", "Can be combined with other promotions", "Limit per customer", "Total usage limit", "Redemptions",
    ]) {
      expect(field(label), label).toHaveTextContent("Not available")
    }
    expect(screen.queryByText(/all order types|every order|subtotal|delivery fee|restaurant pays|foodi pays/i)).toBeNull()
  })

  it("does not claim a cap for a fixed amount", () => {
    renderDetail(bare())
    expect(field("Maximum discount")).toHaveTextContent("Not applicable to a fixed amount")
  })

  it("shows a percentage with no cap as unavailable", () => {
    renderDetail(promotion({ discount: { type: "percentage", rateBasisPoints: 500, maxDiscount: null } }))
    expect(field("Maximum discount")).toHaveTextContent("Not available")
  })

  it("shows stackable and not-stackable as supplied", () => {
    const { unmount } = renderDetail(promotion({ stackable: true }))
    expect(field("Can be combined with other promotions")).toHaveTextContent("Yes")
    unmount()
    renderDetail(promotion({ stackable: false }))
    expect(field("Can be combined with other promotions")).toHaveTextContent("No")
  })

  it("states times in the restaurant's time zone and the count as Foodi's, with nothing adjusted", () => {
    const { container } = renderDetail(promotion())
    expect(container).toHaveTextContent("Asia/Kolkata")
    expect(container).toHaveTextContent(/counted by Foodi/i)
    expect(container).toHaveTextContent(/doesn.t adjust it/i)
  })

  it("shows no customer, order or redemption-history data and no control", () => {
    const { container } = renderDetail(promotion())
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(container).not.toHaveTextContent(/customer name|order #|redeemed by|history|export|download|segment/i)
  })

  it("heads the page with the code, and says what the page does not do", () => {
    const { container } = render(
      <>
        <PromotionHeading promotion={promotion()} />
        <PromotionDisclaimer />
      </>
    )
    expect(screen.getByRole("heading", { level: 1, name: "PREVIEW-TEST1" })).toBeInTheDocument()
    expect(container).toHaveTextContent(/read-only/i)
    expect(container).toHaveTextContent(/doesn.t calculate savings, check who is eligible, or work out whether a coupon is valid right now/i)
  })
})

describe("formatting", () => {
  it("formats the given rate and amount without arithmetic", () => {
    expect(formatRate(1234, "en-IN")).toBe("12.34%")
    expect(formatRate(0, "en-IN")).toBe("0%")
    expect(formatRate(10_000, "en-IN")).toBe("100%")
    expect(discountText({ type: "fixed_amount", amount: inr(1000) }, "en-IN")).toMatch(/₹10\.00 off/)
    expect(discountText({ type: "percentage", rateBasisPoints: 50, maxDiscount: inr(1) }, "en-IN")).toBe("0.5% off")
  })
})

describe("PromotionsPagination", () => {
  const renderPagination = (page: Parameters<typeof PromotionsPagination>[0]["page"], itemCount: number) =>
    render(<PromotionsPagination page={page} itemCount={itemCount} hrefFor={(target) => `/promotions?page=${target}`} />)

  it("shows the range and total when the source supplies them", () => {
    renderPagination({ page: 2, pageSize: 10, totalItems: 14, totalPages: 2, hasNextPage: false }, 4)
    expect(screen.getByText("Showing 11–14 of 14 coupons")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/promotions?page=1")
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })

  it("invents no total when the source has none, and follows the next-page flag", () => {
    renderPagination({ page: 1, pageSize: 10, totalItems: null, totalPages: null, hasNextPage: true }, 10)
    const nav = screen.getByRole("navigation", { name: "Coupons pagination" })
    expect(nav).toHaveTextContent("Showing 1–10 on this page")
    expect(nav).not.toHaveTextContent(/of \d/)
    expect(screen.getByRole("link", { name: "Next page" })).toBeInTheDocument()
  })
})

describe("PromotionsToolbar", () => {
  it("offers every status filter as a link and marks the current one", () => {
    render(<PromotionsToolbar query={parsePromotionListQuery({ status: "paused", page: "3" })} />)
    for (const label of ["All", "Scheduled", "Active", "Paused", "Expired", "Cancelled"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole("link", { name: "Paused" })).toHaveAttribute("aria-current", "page")
    // Changing the filter returns to page 1.
    expect(screen.getByRole("link", { name: "Active" })).toHaveAttribute("href", "/promotions?status=active")
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/promotions")
    expect(screen.getByRole("link", { name: "Reset filter" })).toHaveAttribute("href", "/promotions")
  })

  it("offers no reset when no filter is active, and has no form control", () => {
    render(<PromotionsToolbar query={defaultQuery} />)
    expect(screen.queryByRole("link", { name: "Reset filter" })).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("states", () => {
  it("shows not connected, permission and retryable errors, never sample data or the raw error", () => {
    const { rerender } = render(<PromotionsLoadFailure error={new ServiceError("not_configured")} retryHref="/promotions" />)
    expect(screen.getByText("Promotions aren't connected yet")).toBeInTheDocument()
    rerender(<PromotionsLoadFailure error={new ServiceError("forbidden")} retryHref="/promotions" />)
    expect(screen.getByRole("alert")).toHaveTextContent(/permission/i)
    rerender(<PromotionsLoadFailure error={new ServiceError("unavailable", "secret detail 1234")} retryHref="/promotions?status=paused" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load coupons")
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret detail")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/promotions?status=paused")
  })

  it("offers a way out of an empty filter", () => {
    render(<PromotionsNoResults />)
    expect(screen.getByRole("link", { name: "Reset filter" })).toHaveAttribute("href", "/promotions")
  })
})
