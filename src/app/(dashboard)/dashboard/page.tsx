import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ChartLine,
  CircleCheck,
  Clock,
  Inbox,
  ListChecks,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { HoursLoadFailure } from "@/components/hours/hours-states"
import { PauseBanner } from "@/components/hours/pause-banner"
import { StatusCard } from "@/components/hours/status-card"
import { Skeleton } from "@/components/ui/skeleton"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getAvailabilityStatus, getHoursContext, hoursMode } from "@/lib/hours/service"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Dashboard",
}

// Values stay null until real order data is connected; nothing here is sample data.
const summaryStats = [
  { title: "Today's Orders", icon: ShoppingBag, value: null },
  { title: "Today's Sales", icon: Wallet, value: null },
  { title: "Pending Orders", icon: Clock, value: null },
  { title: "Completed Orders", icon: CircleCheck, value: null },
]

const quickActions = [
  { title: "View orders", description: "Accept and track incoming orders", icon: ReceiptText },
  { title: "Update menu", description: "Edit dishes, prices and availability", icon: UtensilsCrossed },
  { title: "Edit restaurant profile", description: "Details and opening hours", icon: Store },
  { title: "Restaurant settings", description: "Preferences for your restaurant", icon: Settings },
]

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Welcome to your restaurant dashboard"
        description="Your restaurant's day at a glance: orders, sales and the tasks that need attention. Figures appear here once your restaurant's data is connected to Foodi."
      />

      <Suspense fallback={<Skeleton role="status" aria-label="Loading opening status" className="h-24 w-full rounded-xl" />}>
        <OpeningStatus />
      </Suspense>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          Today&apos;s summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {summaryStats.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              icon={stat.icon}
              value={stat.value}
              emptyHint="Appears once orders are connected"
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardSection
          title="Recent orders"
          description="The latest orders placed with your restaurant."
          className="lg:col-span-2"
        >
          <EmptyState
            icon={Inbox}
            title="No orders to show"
            description="Recent orders will be listed here once order management is connected."
            className="min-h-64"
          />
        </DashboardSection>

        <DashboardSection
          title="Order status overview"
          description="How today's orders are progressing."
        >
          <EmptyState
            icon={ListChecks}
            title="No order activity yet"
            description="A breakdown of orders by status will appear here."
            className="min-h-64"
          />
        </DashboardSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardSection
          title="Sales & order trends"
          description="Sales and order volume over time."
          className="lg:col-span-2"
        >
          <EmptyState
            icon={ChartLine}
            title="No trend data yet"
            description="Charts will appear once there's order history to report on."
            className="min-h-56"
          />
        </DashboardSection>

        <DashboardSection
          title="Quick actions"
          description="Shortcuts to common tasks."
        >
          <ul className="flex flex-col gap-2">
            {quickActions.map(({ title, description, icon: Icon }) => (
              <li
                key={title}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground/80">
                    {title}
                    <span className="sr-only"> (coming soon)</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Soon
                </span>
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </div>
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

function DashboardSection({
  title,
  description,
  className,
  children,
}: {
  title: string
  description: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("gap-5 shadow-none", className)}>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
