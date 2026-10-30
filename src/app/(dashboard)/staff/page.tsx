import { Suspense } from "react"
import type { Metadata } from "next"
import { Users } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { MenuListSkeleton } from "@/components/menu/menu-states"
import { OpsLoadFailure } from "@/components/shared/ops-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { StaffDirectory } from "@/components/staff/staff-directory"
import { getStaff, staffMode } from "@/lib/staff"

export const metadata: Metadata = {
  title: "Staff & roles",
}

export default function StaffPage({ searchParams }: PageProps<"/staff">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader variant="hero" title="Staff & roles" description="Who works at your restaurant, what role they have and which areas that role can use." />
      <Suspense fallback={<MenuListSkeleton label="Loading staff" />}>
        <StaffView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function StaffView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let data
  try {
    data = await getStaff(preview)
  } catch (error) {
    return <OpsLoadFailure error={error} retryHref="/staff" icon={Users} what="Staff and roles" />
  }
  return (
    <div className="flex flex-col gap-5">
      {staffMode() === "preview" ? <PreviewNotice detail="The staff, roles and access shown are made up." /> : null}
      {data.members.length === 0 ? (
        <EmptyState icon={Users} title="No staff yet" description="Staff you invite will appear here." className="min-h-72 rounded-3xl border-border bg-card" />
      ) : (
        <StaffDirectory data={data} />
      )}
    </div>
  )
}
