import { Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Plan } from "@/lib/billing/types"

import { DateValue, PlanModelText, PlanStatusBadge, Unavailable, feeValueText, formatCalendarDate, taxText } from "./billing-values"

export function PlanSummary({ plan }: { plan: Plan }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Current plan</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Row label="Plan">{plan.name}</Row>
          <Row label="Model">
            <PlanModelText model={plan.model} />
          </Row>
          <Row label="Status">
            <PlanStatusBadge status={plan.status} />
          </Row>
        </dl>
      </CardContent>
    </Card>
  )
}

/** A notice is wording from the server, shown as plain text and as given. */
export function PlanNotice({ notice }: { notice: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed whitespace-pre-wrap">
        <span className="font-semibold">Message from Foodi: </span>
        {notice}
      </p>
    </div>
  )
}

export function PlanDates({ plan, locale }: { plan: Plan; locale: string }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Billing cycle</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Row label="Current period">
            {plan.periodStart === null || plan.periodEnd === null ? (
              plan.periodStart === null && plan.periodEnd === null ? (
                <Unavailable />
              ) : (
                <>
                  {plan.periodStart !== null ? <>From {formatCalendarDate(plan.periodStart, locale)}</> : null}
                  {plan.periodEnd !== null ? <>Until {formatCalendarDate(plan.periodEnd, locale)}</> : null}
                </>
              )
            ) : (
              <>
                <DateValue date={plan.periodStart} locale={locale} />
                {" – "}
                <DateValue date={plan.periodEnd} locale={locale} />
              </>
            )}
          </Row>
          <Row label="Renewal date">
            <DateValue date={plan.renewsOn} locale={locale} />
          </Row>
          <Row label="Trial ends">
            <DateValue date={plan.trialEndsOn} locale={locale} />
          </Row>
        </dl>
      </CardContent>
    </Card>
  )
}

export function PlanEntitlements({ plan }: { plan: Plan }) {
  return (
    <section aria-labelledby="plan-entitlements-heading" className="flex flex-col gap-3">
      <h2 id="plan-entitlements-heading" className="text-base font-semibold">
        What the plan includes
      </h2>
      {plan.entitlements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entitlements were provided for this plan.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {plan.entitlements.map((entitlement, index) => (
            <li key={index} className="px-4 py-3">
              <p className="text-sm font-medium">{entitlement.label}</p>
              {entitlement.detail !== null ? <p className="text-xs text-muted-foreground">{entitlement.detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function PlanFeeTerms({ plan, locale }: { plan: Plan; locale: string }) {
  return (
    <section aria-labelledby="plan-fees-heading" className="flex flex-col gap-3">
      <h2 id="plan-fees-heading" className="text-base font-semibold">
        Fees
      </h2>
      {plan.feeTerms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fee terms were provided for this plan.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {plan.feeTerms.map((term, index) => (
            <li key={index} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-sm font-medium">{term.label}</p>
              <div className="text-sm sm:text-right">
                <p className="font-medium tabular-nums">{feeValueText(term, locale)}</p>
                {term.tax !== null ? <p className="text-xs text-muted-foreground">{taxText(term.tax, locale)}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Said once on the page: what it is, and what it doesn't do. */
export function BillingDisclaimer() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Everything on this page is shown as provided by Foodi&apos;s billing service. This page doesn&apos;t calculate fees or tax,
      doesn&apos;t check or change what your restaurant can do, and isn&apos;t an invoice.
    </p>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
