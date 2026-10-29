import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"
import { parseCustomerListQuery } from "@/lib/customers/query"
import type { Customer, CustomerDetail, CustomerOrderSummary } from "@/lib/customers/types"

import { CustomerHeading, CustomerOrdersList, CustomerProfile } from "./customer-profile"
import { CustomersList } from "./customers-list"
import { CustomersPagination } from "./customers-pagination"
import { CustomersLoadFailure, CustomersNoResults } from "./customers-states"
import { CustomersToolbar } from "./customers-toolbar"

const context = { timeZone: "Asia/Kolkata", locale: "en-IN" }
const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "cus_1",
  displayName: "Preview customer 01",
  phoneMasked: "•••••• ••10",
  emailMasked: "p•••@e•••••.example",
  orderCount: 3,
  lifetimeSpend: { amountMinor: 120000, currency: "INR" },
  lastOrderAt: "2026-10-27T09:30:00Z",
  ...overrides,
})
const order = (overrides: Partial<CustomerOrderSummary> = {}): CustomerOrderSummary => ({
  id: "prv-1001",
  reference: "PRV-1001",
  placedAt: "2026-10-27T09:30:00Z",
  status: "completed",
  paymentStatus: "paid",
  orderType: "takeaway",
  deliveryMode: null,
  itemCount: 2,
  total: { amountMinor: 52000, currency: "INR" },
  ...overrides,
})
const defaultQuery = parseCustomerListQuery({})
const pagination = (page: Parameters<typeof CustomersPagination>[0]["page"], itemCount: number) => (
  <CustomersPagination
    label="Customers pagination"
    noun="customer"
    nounPlural="customers"
    page={page}
    itemCount={itemCount}
    hrefFor={(target) => `/customers?page=${target}`}
  />
)

describe("CustomersList", () => {
  const renderList = (customers: Customer[]) =>
    render(<CustomersList customers={customers} query={defaultQuery} context={context} />)
  const firstRow = () => screen.getByRole("table").querySelector("tbody tr") as HTMLElement

  it("shows name, masked contact, orders, spend and last order", () => {
    renderList([customer()])
    const row = firstRow()
    expect(within(row).getByText("Preview customer 01")).toBeInTheDocument()
    expect(within(row).getByText("•••••• ••10")).toBeInTheDocument()
    expect(within(row).getByText("p•••@e•••••.example")).toBeInTheDocument()
    expect(within(row).getByText("3")).toBeInTheDocument()
    expect(within(row).getByText(/1,200/)).toBeInTheDocument()
    expect(within(row).getByText(/2026/)).toBeInTheDocument()
  })

  it("marks missing metrics unavailable, never zero (C9)", () => {
    renderList([customer({ orderCount: null, lifetimeSpend: null, lastOrderAt: null })])
    expect(within(firstRow()).getAllByText("Not available")).toHaveLength(3)
  })

  it("keeps a real zero as zero", () => {
    renderList([customer({ orderCount: 0, lifetimeSpend: { amountMinor: 0, currency: "INR" } })])
    expect(within(firstRow()).getByText("0")).toBeInTheDocument()
    expect(within(firstRow()).getByText(/₹\s?0\.00/)).toBeInTheDocument()
  })

  it("says so for an unnamed customer and for no contact details", () => {
    renderList([customer({ displayName: null, phoneMasked: null, emailMasked: null })])
    expect(within(firstRow()).getByText("Name not shared")).toBeInTheDocument()
    expect(within(firstRow()).getByText("No contact details shared")).toBeInTheDocument()
  })

  it("links each customer by id to the profile, carrying the list view", () => {
    render(
      <CustomersList
        customers={[customer()]}
        query={parseCustomerListQuery({ q: "pre", sort: "name", page: "2" })}
        context={context}
      />
    )
    const links = screen.getAllByRole("link", { name: /Preview customer 01/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute("href", "/customers/cus_1?q=pre&sort=name&page=2")
  })

  it("offers no reveal, copy, call, email or export controls and no tel: or mailto: links", () => {
    const { container } = renderList([customer()])
    expect(screen.queryByRole("button")).toBeNull()
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull()
    expect(container).not.toHaveTextContent(/reveal|copy|export|show phone|show email/i)
  })
})

describe("CustomerProfile", () => {
  const detail: CustomerDetail = { ...customer(), firstOrderAt: "2026-01-05T08:00:00Z" }

  it("shows masked contact, metrics and both dates, with a privacy note and no controls", () => {
    const { container } = render(<CustomerProfile customer={detail} context={context} />)
    expect(screen.getByText("•••••• ••10")).toBeInTheDocument()
    expect(screen.getByText("p•••@e•••••.example")).toBeInTheDocument()
    expect(screen.getByText(/1,200/)).toBeInTheDocument()
    expect(screen.getByText(/Jan 2026/)).toBeInTheDocument()
    expect(screen.getByText(/hidden to protect/i)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull()
  })

  it("shows unavailable markers for missing values", () => {
    render(
      <CustomerProfile
        customer={{
          ...detail,
          phoneMasked: null,
          emailMasked: null,
          orderCount: null,
          lifetimeSpend: null,
          lastOrderAt: null,
          firstOrderAt: null,
        }}
        context={context}
      />
    )
    expect(screen.getAllByText("Not available")).toHaveLength(6)
  })

  it("headlines the name, or says it isn't shared", () => {
    const { rerender } = render(<CustomerHeading customer={detail} />)
    expect(screen.getByRole("heading", { level: 1, name: "Preview customer 01" })).toBeInTheDocument()
    rerender(<CustomerHeading customer={{ displayName: null }} />)
    expect(screen.getByRole("heading", { level: 1, name: "Name not shared" })).toBeInTheDocument()
  })
})

describe("CustomerOrdersList", () => {
  it("links each row to the existing order detail by the supplied id", () => {
    render(<CustomerOrdersList orders={[order(), order({ id: "a/b", reference: "PRV-1002" })]} context={context} />)
    const hrefs = screen.getAllByRole("link", { name: /PRV-100/ }).map((link) => link.getAttribute("href"))
    expect(new Set(hrefs)).toEqual(new Set(["/orders/prv-1001", "/orders/a%2Fb"]))
  })

  it("shows status, payment, total and order type", () => {
    render(<CustomerOrdersList orders={[order({ status: "cancelled", paymentStatus: "refunded" })]} context={context} />)
    const row = screen.getByRole("table").querySelector("tbody tr") as HTMLElement
    expect(within(row).getByText("Cancelled")).toBeInTheDocument()
    expect(within(row).getByText("Refunded")).toBeInTheDocument()
    expect(within(row).getByText(/520/)).toBeInTheDocument()
    expect(within(row).getByText("Takeaway")).toBeInTheDocument()
  })
})

describe("CustomersPagination", () => {
  it("shows the range and total when the source supplies them", () => {
    render(pagination({ page: 2, pageSize: 10, totalItems: 25, totalPages: 3, hasNextPage: true }, 10))
    expect(screen.getByText("Showing 11–20 of 25 customers")).toBeInTheDocument()
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/customers?page=1")
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/customers?page=3")
  })

  it("invents no total when the source has none (C9), and follows the next-page flag", () => {
    render(pagination({ page: 1, pageSize: 10, totalItems: null, totalPages: null, hasNextPage: true }, 10))
    const nav = screen.getByRole("navigation", { name: "Customers pagination" })
    expect(nav).toHaveTextContent("Showing 1–10 on this page")
    expect(nav).not.toHaveTextContent(/of \d/)
    expect(screen.getByText("Page 1")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Next page" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
  })

  it("disables Next on the last page", () => {
    render(pagination({ page: 3, pageSize: 10, totalItems: 25, totalPages: 3, hasNextPage: false }, 5))
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })
})

describe("CustomersToolbar", () => {
  it("has a labelled search limited to 60 characters that keeps a non-default sort", () => {
    const { container } = render(
      <CustomersToolbar query={parseCustomerListQuery({ q: "asha", sort: "name" })} supportedSorts={["recent", "name"]} />
    )
    const input = screen.getByLabelText("Search customers by name")
    expect(input).toHaveAttribute("maxlength", "60")
    expect(input).toHaveValue("asha")
    expect(container.querySelector('input[type="hidden"][name="sort"]')).toHaveAttribute("value", "name")
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/customers?sort=name")
  })

  it("disables a sort the source doesn't support, and marks the current one", () => {
    render(<CustomersToolbar query={parseCustomerListQuery({ sort: "name" })} supportedSorts={["name"]} />)
    expect(screen.queryByRole("link", { name: "Last order" })).toBeNull()
    expect(screen.getByText("Last order")).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("link", { name: "Name A–Z" })).toHaveAttribute("aria-current", "page")
  })

  it("offers every sort while support is unknown", () => {
    render(<CustomersToolbar query={defaultQuery} supportedSorts={null} />)
    expect(screen.getByRole("link", { name: "Name A–Z" })).toBeInTheDocument()
  })
})

describe("states", () => {
  it("shows not connected, permission and retryable errors, never sample data", () => {
    const { rerender } = render(<CustomersLoadFailure error={new ServiceError("not_configured")} retryHref="/customers" />)
    expect(screen.getByText("Customers aren't connected yet")).toBeInTheDocument()
    rerender(<CustomersLoadFailure error={new ServiceError("forbidden")} retryHref="/customers" />)
    expect(screen.getByRole("alert")).toHaveTextContent(/permission/i)
    rerender(<CustomersLoadFailure error={new ServiceError("unavailable", "secret detail")} retryHref="/customers?page=2" />)
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret detail")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/customers?page=2")
    rerender(<CustomersLoadFailure error={new Error("boom")} retryHref="/customers" what="order history" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load order history")
  })

  it("offers a way out of an empty search", () => {
    render(<CustomersNoResults />)
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/customers")
  })
})
