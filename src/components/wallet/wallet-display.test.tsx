import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"
import type {
  Money,
  SettlementDetail,
  SettlementOrder,
  SettlementSummary,
  WalletSummary as WalletSummaryData,
} from "@/lib/wallet/types"

import { SettlementHeading, SettlementLines, SettlementOrders, SettlementOverview } from "./settlement-detail"
import { SettlementsList } from "./settlements-list"
import { WalletLoadFailure } from "./wallet-states"
import { WalletPagination } from "./wallet-pagination"
import { WalletSummary } from "./wallet-summary"
import { SettlementStatusBadge } from "./wallet-values"

const context = { timeZone: "Asia/Kolkata", locale: "en-IN" }
const inr = (amountMinor: number): Money => ({ amountMinor, currency: "INR" })
const summary = (overrides: Partial<SettlementSummary> = {}): SettlementSummary => ({
  id: "set_1",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-07",
  status: "paid",
  grossAmount: inr(111100),
  netAmount: inr(99000),
  orderCount: 12,
  paidAt: "2026-10-09T10:00:00Z",
  ...overrides,
})
const detail = (overrides: Partial<SettlementDetail> = {}): SettlementDetail => ({
  ...summary(),
  payoutDestinationLabel: "Bank •••• 1234",
  lines: [
    { kind: "commission", label: "Platform commission", amount: inr(-11110), refundStatus: null },
    { kind: "refund", label: "Refund, order A", amount: inr(-5000), refundStatus: "pending" },
    { kind: "refund", label: "Refund, order B", amount: inr(-4000), refundStatus: "confirmed" },
  ],
  ...overrides,
})
const order = (overrides: Partial<SettlementOrder> = {}): SettlementOrder => ({
  id: "prv-1001",
  reference: "PRV-1001",
  placedAt: "2026-10-02T10:00:00Z",
  orderTotal: inr(52000),
  commission: inr(-5200),
  net: inr(46800),
  refund: null,
  ...overrides,
})

describe("WalletSummary", () => {
  const data: WalletSummaryData = {
    pendingSettlement: inr(333300),
    paidOut: inr(9999900),
    onHold: null,
    asOf: null,
    payoutDestinationLabel: "Bank •••• 1234",
  }

  it("shows each named amount as supplied, with unavailable ones as a marker, never zero", () => {
    render(<WalletSummary summary={data} context={context} />)
    expect(screen.getByText("Pending settlement").closest("div")).toHaveTextContent(/3,333\.00/)
    expect(screen.getByText("Paid out").closest("div")).toHaveTextContent(/99,999\.00/)
    const onHold = screen.getByText("On hold").closest("div")!
    expect(within(onHold).getByText("Not available")).toBeInTheDocument()
    expect(onHold).not.toHaveTextContent("0.00")
  })

  it("shows only a masked destination label, says it can't be changed, and has no controls", () => {
    const { container } = render(<WalletSummary summary={data} context={context} />)
    expect(screen.getByText("Bank •••• 1234")).toBeInTheDocument()
    expect(screen.getByText(/can.t be seen or changed here/i)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(container).not.toHaveTextContent(/withdraw|payout now|request|automatic|export|statement/i)
  })

  it("says nothing about how or when money is paid, and that it doesn't verify the figures", () => {
    const { container } = render(<WalletSummary summary={data} context={context} />)
    expect(container).toHaveTextContent(/doesn.t calculate or verify/i)
    expect(container).not.toHaveTextContent(/automatically|every week|daily|weekly/i)
  })

  it("marks a missing destination unavailable", () => {
    render(<WalletSummary summary={{ ...data, payoutDestinationLabel: null }} context={context} />)
    const destination = screen.getByRole("heading", { name: "Payout destination" }).closest('[data-slot="card"]') as HTMLElement
    expect(within(destination).getByText("Not available")).toBeInTheDocument()
  })
})

describe("SettlementsList", () => {
  const firstRow = () => screen.getByRole("table").querySelector("tbody tr") as HTMLElement

  it("shows the supplied period, status, orders and amounts", () => {
    render(<SettlementsList settlements={[summary()]} listPage={1} context={context} />)
    const row = firstRow()
    expect(within(row).getByText(/1 Oct 2026/)).toBeInTheDocument()
    expect(within(row).getByText(/7 Oct 2026/)).toBeInTheDocument()
    expect(within(row).getByText("Paid")).toBeInTheDocument()
    expect(within(row).getByText("12")).toBeInTheDocument()
    expect(within(row).getByText(/1,111\.00/)).toBeInTheDocument()
    expect(within(row).getByText(/990\.00/)).toBeInTheDocument()
  })

  it("shows a missing status and missing amounts as unavailable, not as a status or zero", () => {
    render(
      <SettlementsList
        settlements={[summary({ status: null, grossAmount: null, netAmount: null, orderCount: null })]}
        listPage={1}
        context={context}
      />
    )
    expect(within(firstRow()).getAllByText("Not available")).toHaveLength(4)
    expect(firstRow()).not.toHaveTextContent(/paid|pending|failed|0\.00/i)
  })

  it("shows a negative net amount with its sign", () => {
    render(<SettlementsList settlements={[summary({ netAmount: inr(-500) })]} listPage={1} context={context} />)
    expect(within(firstRow()).getByText(/-.*5\.00|−.*5\.00/)).toBeInTheDocument()
  })

  it("links each settlement by id to its detail, carrying the list page", () => {
    render(<SettlementsList settlements={[summary()]} listPage={2} context={context} />)
    const links = screen.getAllByRole("link", { name: /settlement 2026-10-01 to 2026-10-07|2026-10-01/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute("href", "/wallet/settlements/set_1?page=2")
  })

  it("offers no payout, withdrawal or export controls", () => {
    const { container } = render(<SettlementsList settlements={[summary()]} listPage={1} context={context} />)
    expect(screen.queryByRole("button")).toBeNull()
    expect(container).not.toHaveTextContent(/withdraw|request payout|export|download/i)
  })
})

describe("SettlementStatusBadge", () => {
  it.each([
    ["pending", "Pending"],
    ["processing", "Processing"],
    ["paid", "Paid"],
    ["failed", "Failed"],
    ["on_hold", "On hold"],
  ] as const)("labels %s as %s", (status, label) => {
    render(<SettlementStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("says nothing for a missing status", () => {
    render(<SettlementStatusBadge status={null} />)
    expect(screen.getByText("Not available")).toBeInTheDocument()
    expect(screen.queryByText("Paid")).toBeNull()
  })
})

describe("SettlementOverview and heading", () => {
  it("shows the supplied status and amounts, says they are not verified, and never claims a bank transfer", () => {
    const { container } = render(<SettlementOverview settlement={detail()} context={context} />)
    expect(screen.getByText("Paid")).toBeInTheDocument()
    expect(container).toHaveTextContent(/doesn.t verify them or any bank transfer/i)
    expect(container).not.toHaveTextContent(/transferred|deposited|received in your bank/i)
    expect(screen.getByText("Bank •••• 1234")).toBeInTheDocument()
  })

  it("shows unavailable markers for missing values", () => {
    render(
      <SettlementOverview
        settlement={detail({ status: null, grossAmount: null, netAmount: null, orderCount: null, paidAt: null, payoutDestinationLabel: null })}
        context={context}
      />
    )
    expect(screen.getAllByText("Not available")).toHaveLength(6)
  })

  it("headlines the supplied period", () => {
    render(<SettlementHeading settlement={summary()} locale="en-IN" />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Settlement 1 Oct 2026 – 7 Oct 2026/)
  })
})

describe("SettlementLines", () => {
  it("shows labelled amounts as supplied, with signs, and does not add them up", () => {
    const { container } = render(<SettlementLines settlement={detail()} context={context} />)
    expect(screen.getByText("Platform commission")).toBeInTheDocument()
    expect(screen.getByText("Commission")).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/total|sum|balance/i)
  })

  it("keeps a pending refund distinct from a provider-confirmed one", () => {
    render(<SettlementLines settlement={detail()} context={context} />)
    expect(screen.getByText(/refund pending, not final until the payment provider confirms it/i)).toBeInTheDocument()
    expect(screen.getByText(/refund confirmed by the payment provider/i)).toBeInTheDocument()
  })

  it("says so when no lines were provided", () => {
    render(<SettlementLines settlement={detail({ lines: [] })} context={context} />)
    expect(screen.getByText(/no commission, fee, tax or adjustment lines were provided/i)).toBeInTheDocument()
  })
})

describe("SettlementOrders", () => {
  it("links an order to its page only when an order id was supplied", () => {
    render(<SettlementOrders orders={[order(), order({ id: null, reference: "NOLINK-1" })]} context={context} />)
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    expect(new Set(hrefs)).toEqual(new Set(["/orders/prv-1001"]))
    expect(screen.getAllByText("NOLINK-1").length).toBeGreaterThan(0)
    expect(screen.queryByRole("link", { name: /NOLINK-1/ })).toBeNull()
  })

  it("encodes the order id in the link", () => {
    render(<SettlementOrders orders={[order({ id: "a/b" })]} context={context} />)
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAttribute("href", "/orders/a%2Fb")
  })

  it("shows unavailable amounts as a marker and each refund with its state", () => {
    render(
      <SettlementOrders
        orders={[
          order({ orderTotal: null, commission: null, net: null, placedAt: null }),
          order({ id: "o2", reference: "PRV-2", refund: { amount: inr(-100), status: "pending" } }),
          order({ id: "o3", reference: "PRV-3", refund: { amount: inr(-100), status: "confirmed" } }),
        ]}
        context={context}
      />
    )
    const rows = screen.getByRole("table").querySelectorAll("tbody tr")
    expect(within(rows[0] as HTMLElement).getAllByText("Not available").length).toBeGreaterThanOrEqual(4)
    expect(within(rows[1] as HTMLElement).getByText(/refund pending/i)).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByText(/refund confirmed/i)).toBeInTheDocument()
  })
})

describe("WalletPagination", () => {
  const render10 = (page: Parameters<typeof WalletPagination>[0]["page"], itemCount: number) =>
    render(
      <WalletPagination
        label="Settlements pagination"
        noun="settlement"
        nounPlural="settlements"
        page={page}
        itemCount={itemCount}
        hrefFor={(target) => `/wallet/settlements?page=${target}`}
      />
    )

  it("shows the range and total when the source supplies them", () => {
    render10({ page: 2, pageSize: 10, totalItems: 14, totalPages: 2, hasNextPage: false }, 4)
    expect(screen.getByText("Showing 11–14 of 14 settlements")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/wallet/settlements?page=1")
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })

  it("invents no total when the source has none, and follows the next-page flag", () => {
    render10({ page: 1, pageSize: 10, totalItems: null, totalPages: null, hasNextPage: true }, 10)
    const nav = screen.getByRole("navigation", { name: "Settlements pagination" })
    expect(nav).toHaveTextContent("Showing 1–10 on this page")
    expect(nav).not.toHaveTextContent(/of \d/)
    expect(screen.getByRole("link", { name: "Next page" })).toBeInTheDocument()
  })
})

describe("states", () => {
  it("shows not connected, permission and retryable errors, never sample data or the raw error", () => {
    const { rerender } = render(<WalletLoadFailure error={new ServiceError("not_configured")} retryHref="/wallet" />)
    expect(screen.getByText("Wallet isn't connected yet")).toBeInTheDocument()
    rerender(<WalletLoadFailure error={new ServiceError("forbidden")} retryHref="/wallet" />)
    expect(screen.getByRole("alert")).toHaveTextContent(/permission/i)
    rerender(<WalletLoadFailure error={new ServiceError("unavailable", "secret detail 1234")} retryHref="/wallet/settlements?page=2" what="settlements" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load settlements")
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret detail")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/wallet/settlements?page=2")
  })
})
