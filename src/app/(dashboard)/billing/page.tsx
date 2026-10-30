import { Suspense } from "react"
import type { Metadata } from "next"

import { BillingLoadFailure, BillingSkeleton, NoPlan } from "@/components/billing/billing-states"
import {
  BillingDisclaimer,
  PlanDates,
  PlanEntitlements,
  PlanFeeTerms,
  PlanNotice,
  PlanSummary,
} from "@/components/billing/plan-details"
import { PageHeader } from "@/components/dashboard/page-header"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { billingMode, getBillingContext, getPlan } from "@/lib/billing/service"

export const metadata: Metadata = {
  title: "Plan & billing",
}

const BILLING_PATH = "/billing"

export default function BillingPage({ searchParams }: PageProps<"/billing">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Plan & billing"
        description="Your plan, billing cycle and fees, as provided by Foodi. This page is read-only."
      />
      <Suspense fallback={<BillingSkeleton />}>
        <BillingView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function BillingView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  const isPreview = billingMode() === "preview"

  let loaded
  try {
    const [context, plan] = await Promise.all([getBillingContext(), getPlan(preview)])
    loaded = { context, plan }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <BillingLoadFailure error={error} retryHref={BILLING_PATH} />
  }
  const { context, plan } = loaded
  if (plan === null) {
    return (
      <div className="flex flex-col gap-4">
        {isPreview ? <PreviewNotice detail="Sample plans are made up and are not real prices or terms." /> : null}
        <NoPlan />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {isPreview ? <PreviewNotice detail="Sample plans are made up and are not real prices or terms." /> : null}
      {plan.notice !== null ? <PlanNotice notice={plan.notice} /> : null}
      <PlanSummary plan={plan} />
      <PlanDates plan={plan} locale={context.locale} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanEntitlements plan={plan} />
        <PlanFeeTerms plan={plan} locale={context.locale} />
      </div>
      <BillingDisclaimer />
    </div>
  )
}
