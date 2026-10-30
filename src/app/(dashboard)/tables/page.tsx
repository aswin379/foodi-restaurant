import { Suspense } from "react"
import type { Metadata } from "next"
import { LayoutGrid } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/dashboard/empty-state"
import { OpsLoadFailure } from "@/components/shared/ops-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { FloorView } from "@/components/tables/floor-view"
import { MenuListSkeleton } from "@/components/menu/menu-states"
import { listTables, tablesMode } from "@/lib/tables"

export const metadata: Metadata = {
  title: "Tables",
}

export default function TablesPage({ searchParams }: PageProps<"/tables">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Tables"
        description="See the floor at a glance: which tables are free, taken, reserved or being cleaned."
      />
      <Suspense fallback={<MenuListSkeleton label="Loading tables" />}>
        <TablesView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function TablesView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let tables
  try {
    tables = await listTables(preview)
  } catch (error) {
    return <OpsLoadFailure error={error} retryHref="/tables" icon={LayoutGrid} what="Tables" />
  }
  return (
    <div className="flex flex-col gap-5">
      {tablesMode() === "preview" ? <PreviewNotice detail="The floor plan, tables and orders shown are made up." /> : null}
      {tables.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No tables yet" description="Tables you set up will appear here." className="min-h-72 rounded-3xl border-border bg-card" />
      ) : (
        <FloorView tables={tables} locale="en-IN" />
      )}
    </div>
  )
}
