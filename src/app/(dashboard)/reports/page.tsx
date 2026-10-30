import { Suspense } from "react"
import type { Metadata } from "next"
import { ChartColumn } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { MenuListSkeleton } from "@/components/menu/menu-states"
import { ReportsView } from "@/components/reports/reports-view"
import { OpsLoadFailure } from "@/components/shared/ops-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getReports, reportsMode } from "@/lib/reports"

export const metadata: Metadata = {
  title: "Reports",
}

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader variant="hero" title="Reports" description="Sales, orders and what sells, over the period you choose." />
      <Suspense fallback={<MenuListSkeleton label="Loading reports" />}>
        <ReportsPageView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ReportsPageView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let data
  try {
    data = await getReports(preview)
  } catch (error) {
    return <OpsLoadFailure error={error} retryHref="/reports" icon={ChartColumn} what="Reports" />
  }
  return (
    <div className="flex flex-col gap-5">
      {reportsMode() === "preview" ? <PreviewNotice detail="Every figure and chart on this page is made up." /> : null}
      {data === null ? (
        <EmptyState icon={ChartColumn} title="No report data yet" description="Reports will appear here once there are orders to report on." className="min-h-72 rounded-3xl border-border bg-card" />
      ) : (
        <ReportsView data={data} locale="en-IN" />
      )}
    </div>
  )
}
