import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { AttentionList } from "@/components/dashboard/attention-list"
import { DashboardRefresh } from "@/components/dashboard/dashboard-refresh"
import { DashboardSection } from "@/components/dashboard/dashboard-section"
import { SectionSkeleton } from "@/components/dashboard/dashboard-states"
import { LiveOrdersCard } from "@/components/dashboard/live-orders-card"
import { PageHeader } from "@/components/dashboard/page-header"
import { QuickLinks } from "@/components/dashboard/quick-links"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { TodayOrdersCard } from "@/components/dashboard/today-orders-card"
import { HoursLoadFailure } from "@/components/hours/hours-states"
import { PauseBanner } from "@/components/hours/pause-banner"
import { StatusCard } from "@/components/hours/status-card"
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

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Welcome to your restaurant dashboard"
        description="Your restaurant's day at a glance: orders, sales and the tasks that need attention. Figures appear here once your restaurant's data is connected to Foodi."
      />
      <DashboardRefresh />

      <Suspense fallback={<Skeleton role="status" aria-label="Loading opening status" className="h-24 w-full rounded-xl" />}>
        <OpeningStatus />
      </Suspense>

      {/* Each section loads and fails on its own (B5a). */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Suspense fallback={<LoadingSection id="live-orders" title="Live orders" className="lg:col-span-2" />}>
          <LiveOrders searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<LoadingSection id="attention" title="Needs attention" />}>
          <Attention searchParams={searchParams} />
        </Suspense>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Suspense fallback={<LoadingSection id="recent-orders" title="Recent orders" className="lg:col-span-2" rows={5} />}>
          <Recent searchParams={searchParams} />
        </Suspense>
        <div className="flex flex-col gap-6">
          <Suspense fallback={<LoadingSection id="today-orders" title="Today's orders" />}>
            <Today searchParams={searchParams} />
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

function LoadingSection({ id, title, className, rows }: { id: string; title: string; className?: string; rows?: number }) {
  return (
    <DashboardSection id={id} title={title} description="Loading…" className={className}>
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
    <div className="flex flex-col gap-3">
      {hoursMode() === "preview" ? <PreviewNotice detail="Opening status and pause below use sample hours." /> : null}
      {status.pause.paused ? <PauseBanner pause={status.pause} locale={context.locale} /> : null}
      <StatusCard status={status} locale={context.locale} />
      <Link href="/hours" className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline">
        Manage hours and pause
      </Link>
    </div>
  )
}
