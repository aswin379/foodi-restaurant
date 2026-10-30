import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"
import type { Plan } from "@/lib/billing/types"

import { BillingLoadFailure, NoPlan } from "./billing-states"
import { feeValueText, formatRate, taxText } from "./billing-values"
import { BillingDisclaimer, PlanDates, PlanEntitlements, PlanFeeTerms, PlanNotice, PlanSummary } from "./plan-details"

const locale = "en-IN"
const inr = (amountMinor: number) => ({ amountMinor, currency: "INR" })
const plan = (overrides: Partial<Plan> = {}): Plan => ({
  id: "plan_1",
  name: "Test plan",
  model: "hybrid",
  status: "active",
  renewsOn: "2026-11-20",
  trialEndsOn: "2026-11-01",
  periodStart: "2026-10-20",
  periodEnd: "2026-11-19",
  notice: null,
  entitlements: [{ label: "Entitlement A", detail: "Detail A" }, { label: "Entitlement B", detail: null }],
  feeTerms: [
    { label: "Fee per order", basis: "per_order", amount: inr(1111), rateBasisPoints: null, tax: { label: "Tax", treatment: "excluded", rateBasisPoints: 1111 } },
    { label: "Percentage fee", basis: "percentage_of_order", amount: null, rateBasisPoints: 1234, tax: { label: "Tax", treatment: "included", rateBasisPoints: null } },
    { label: "Period fee", basis: "per_period", amount: inr(111100), rateBasisPoints: null, tax: null },
  ],
  ...overrides,
})

describe("PlanSummary", () => {
  it("shows the plan name, model and server status", () => {
    render(<PlanSummary plan={plan()} />)
    expect(screen.getByText("Test plan")).toBeInTheDocument()
    expect(screen.getByText("Commission and subscription")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it.each([
    ["commission", "Commission"],
    ["subscription", "Subscription"],
    ["hybrid", "Commission and subscription"],
  ] as const)("labels the %s model", (model, label) => {
    render(<PlanSummary plan={plan({ model })} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it.each([
    ["active", "Active"],
    ["trialing", "In trial"],
    ["past_due", "Past due"],
    ["expired", "Expired"],
    ["cancelled", "Cancelled"],
  ] as const)("labels the %s status as given", (status, label) => {
    render(<PlanSummary plan={plan({ status })} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("shows a missing model and status as unavailable and assumes neither", () => {
    render(<PlanSummary plan={plan({ model: null, status: null })} />)
    expect(screen.getAllByText("Not available")).toHaveLength(2)
    expect(screen.queryByText("Active")).toBeNull()
    expect(screen.queryByText(/subscription|commission/i)).toBeNull()
  })

  it("makes no claim about access, whatever the status", () => {
    const { container } = render(<PlanSummary plan={plan({ status: "expired" })} />)
    expect(container).not.toHaveTextContent(/restricted|suspended|blocked|locked|disabled|can.t (order|accept)|access/i)
  })
})

describe("PlanDates", () => {
  it("shows the supplied dates exactly as given", () => {
    render(<PlanDates plan={plan()} locale={locale} />)
    expect(screen.getByText("Current period").closest("div")).toHaveTextContent(/20 Oct 2026.*19 Nov 2026/)
    expect(screen.getByText("Renewal date").closest("div")).toHaveTextContent("20 Nov 2026")
    expect(screen.getByText("Trial ends").closest("div")).toHaveTextContent("1 Nov 2026")
  })

  it("shows missing dates as unavailable, and never works one out from another", () => {
    render(<PlanDates plan={plan({ renewsOn: null, trialEndsOn: null, periodStart: null, periodEnd: null })} locale={locale} />)
    expect(screen.getAllByText("Not available")).toHaveLength(3)
  })

  it("says only what a half-given period says", () => {
    render(<PlanDates plan={plan({ periodStart: "2026-10-20", periodEnd: null })} locale={locale} />)
    expect(screen.getByText("Current period").closest("div")).toHaveTextContent("From 20 Oct 2026")
    expect(screen.getByText("Current period").closest("div")).not.toHaveTextContent(/until|–/i)
  })

  it("does not shift a calendar date into another time zone", () => {
    render(<PlanDates plan={plan({ renewsOn: "2026-12-31" })} locale={locale} />)
    expect(screen.getByText("Renewal date").closest("div")).toHaveTextContent("31 Dec 2026")
  })
})

describe("PlanFeeTerms", () => {
  it("states each fee as given, in its own basis", () => {
    render(<PlanFeeTerms plan={plan()} locale={locale} />)
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Fee per order")
    expect(items[0]).toHaveTextContent(/₹11\.11 per order/)
    expect(items[1]).toHaveTextContent("12.34% of order value")
    expect(items[2]).toHaveTextContent(/₹1,111\.00 per billing period/)
  })

  it("shows the supplied tax treatment, label and rate, and never a taxed total", () => {
    const { container } = render(<PlanFeeTerms plan={plan()} locale={locale} />)
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Amount excludes Tax (11.11%)")
    expect(items[1]).toHaveTextContent("Amount includes Tax")
    expect(items[1]).not.toHaveTextContent("%)")
    expect(items[2]).not.toHaveTextContent(/excludes|includes/)
    expect(container).not.toHaveTextContent(/total|payable|you pay|plus tax|incl\. tax/i)
  })

  it("assumes no fee and no tax rate: nothing is hard-coded", () => {
    const { container } = render(<PlanFeeTerms plan={plan({ feeTerms: [] })} locale={locale} />)
    expect(screen.getByText("No fee terms were provided for this plan.")).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/₹|GST|%/)
  })

  it("formats rates and amounts without arithmetic", () => {
    expect(formatRate(1234, locale)).toBe("12.34%")
    expect(formatRate(0, locale)).toBe("0%")
    expect(formatRate(10_000, locale)).toBe("100%")
    expect(feeValueText({ basis: "per_order", amount: inr(1000), rateBasisPoints: null }, locale)).toMatch(/₹10\.00 per order/)
    expect(taxText({ label: "GST", treatment: "excluded", rateBasisPoints: null }, locale)).toBe("Amount excludes GST")
  })
})

describe("PlanEntitlements", () => {
  it("lists the entitlements as given, with no control", () => {
    render(<PlanEntitlements plan={plan()} />)
    expect(screen.getByText("Entitlement A")).toBeInTheDocument()
    expect(screen.getByText("Detail A")).toBeInTheDocument()
    expect(screen.getByText("Entitlement B")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("says so when there are none", () => {
    render(<PlanEntitlements plan={plan({ entitlements: [] })} />)
    expect(screen.getByText("No entitlements were provided for this plan.")).toBeInTheDocument()
  })
})

describe("PlanNotice and disclaimer", () => {
  it("shows a notice as plain text, never as markup", () => {
    const { container } = render(<PlanNotice notice={'<img src=x onerror="alert(1)"> pay now'} />)
    expect(screen.getByRole("note")).toHaveTextContent('<img src=x onerror="alert(1)"> pay now')
    expect(container.querySelector("img")).toBeNull()
  })

  it("says what the page is not, and offers no billing action", () => {
    const { container } = render(<BillingDisclaimer />)
    expect(container).toHaveTextContent(/doesn.t calculate fees or tax/i)
    expect(container).toHaveTextContent(/isn.t an invoice/i)
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("offers no upgrade, payment, cancel, invoice or download control anywhere", () => {
    const { container } = render(
      <>
        <PlanSummary plan={plan()} />
        <PlanDates plan={plan()} locale={locale} />
        <PlanEntitlements plan={plan()} />
        <PlanFeeTerms plan={plan()} locale={locale} />
        <BillingDisclaimer />
      </>
    )
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(container).not.toHaveTextContent(/upgrade|downgrade|cancel|pay now|update payment|invoice(?!\.)|download|compare plans/i)
  })
})

describe("states", () => {
  it("shows not connected, permission and retryable errors, never sample data or the raw error", () => {
    const { rerender } = render(<BillingLoadFailure error={new ServiceError("not_configured")} retryHref="/billing" />)
    expect(screen.getByText("Billing isn't connected yet")).toBeInTheDocument()
    rerender(<BillingLoadFailure error={new ServiceError("forbidden")} retryHref="/billing" />)
    expect(screen.getByRole("alert")).toHaveTextContent(/permission/i)
    rerender(<BillingLoadFailure error={new ServiceError("unavailable", "secret detail 1234")} retryHref="/billing" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your plan")
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret detail")
    expect(within(screen.getByRole("alert")).getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/billing")
  })

  it("keeps no-plan distinct from an error and from not connected", () => {
    render(<NoPlan />)
    expect(screen.getByText("No plan found")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText(/isn.t connected/i)).toBeNull()
  })
})
