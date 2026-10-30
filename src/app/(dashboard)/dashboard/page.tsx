import { Suspense } from "react"
import type { Metadata } from "next"

import { AttentionList } from "@/components/dashboard/attention-list"
import { DashboardRefresh } from "@/components/dashboard/dashboard-refresh"
import { DashboardSection } from "@/components/dashboard/dashboard-section"
import { SectionSkeleton } from "@/components/dashboard/dashboard-states"
import { LiveOrdersCard } from "@/components/dashboard/live-orders-card"
import { OpeningStatus as OpeningStatusPanel } from "@/components/dashboard/opening-status"
import { PageHeader } from "@/components/dashboard/page-header"
import { QuickLinks } from "@/components/dashboard/quick-links"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { TodayOrdersCard } from "@/components/dashboard/today-orders-card"
import { HoursLoadFailure } from "@/components/hours/hours-states"
import { PauseBanner } from "@/components/hours/pause-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getAvailabilityStatus, getHoursContext, hoursMode } from "@/lib/hours/service"

export const metadata: Metadata = {
  title: "Dashboard",
}

const RETRY_HREF = "/dashboard"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Preview scenarios per source (`?previewOrders=`, `?previewMenu=`,
 * `?previewHours=`), so one section's state can be shown on its own. The API
 * adapters ignore them, so they do nothing in production.
 */
async function scenarios(searchParams: SearchParams) {
  const params = await searchParams
  return { orders: params.previewOrders, menu: params.previewMenu, hours: params.previewHours }
}

/**
 * The restaurant's day at a glance. Top to bottom: the greeting, whether new
 * orders are being taken, the live order counts as key figures, then a main
 * column (recent orders, shortcuts) beside a secondary column (what needs
 * attention, today's orders by status). Every section loads and fails on its
 * own, and only shows what the existing services return.
 */
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        variant="hero"
        title="Welcome to your restaurant dashboard"
        description="Here's what's happening with your restaurant today. Figures appear once your restaurant's data is connected to Foodi."
      />
      <DashboardRefresh />

      <Suspense fallback={<Skeleton role="status" aria-label="Loading opening status" className="h-40 w-full rounded-2xl" />}>
        <OpeningStatus />
      </Suspense>

      <Suspense fallback={<LoadingSection id="live-orders" title="Live orders" variant="plain" />}>
        <LiveOrders searchParams={searchParams} />
      </Suspense>

      <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="flex flex-col gap-6 lg:col-span-2 lg:gap-8">
          <Suspense fallback={<LoadingSection id="recent-orders" title="Recent orders" rows={5} />}>
            <Recent searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={<LoadingSection id="today-orders" title="Today's orders" />}>
            <Today searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="flex flex-col gap-6 lg:gap-8">
          <Suspense fallback={<LoadingSection id="attention" title="Needs attention" />}>
            <Attention searchParams={searchParams} />
          </Suspense>
          <QuickLinks />
        </div>
      </div>
    </div>
  )
}

async function LiveOrders({ searchParams }: { searchParams: SearchParams }) {
  return <LiveOrdersCard previewScenario={(await scenarios(searchParams)).orders} retryHref={RETRY_HREF} />
}

async function Today({ searchParams }: { searchParams: SearchParams }) {
  return <TodayOrdersCard previewScenario={(await scenarios(searchParams)).orders} retryHref={RETRY_HREF} />
}

async function Recent({ searchParams }: { searchParams: SearchParams }) {
  return <RecentOrders previewScenario={(await scenarios(searchParams)).orders} retryHref={RETRY_HREF} />
}

async function Attention({ searchParams }: { searchParams: SearchParams }) {
  return <AttentionList previewScenarios={await scenarios(searchParams)} />
}

function LoadingSection({
  id,
  title,
  variant,
  rows,
}: {
  id: string
  title: string
  variant?: "card" | "plain"
  rows?: number
}) {
  return (
    <DashboardSection id={id} title={title} description="Loading…" variant={variant}>
      <SectionSkeleton label={`Loading ${title.toLowerCase()}`} rows={rows} />
    </DashboardSection>
  )
}

/**
 * Pause banner (PRD §3.5) and whether each order type takes new orders, from
 * the hours service. In production, until it's connected, it says so.
 */
async function OpeningStatus() {
  let loaded
  try {
    const [context, status] = await Promise.all([getHoursContext(), getAvailabilityStatus()])
    loaded = { context, status }
  } catch (error) {
    return <HoursLoadFailure error={error} retryHref="/dashboard" compact />
  }
  const { context, status } = loaded
  return (
    <div className="flex flex-col gap-4">
      {hoursMode() === "preview" ? <PreviewNotice detail="Opening status and pause below use sample hours." /> : null}
      {status.pause.paused ? <PauseBanner pause={status.pause} locale={context.locale} /> : null}
      <OpeningStatusPanel status={status} locale={context.locale} />
    </div>
  )
}
