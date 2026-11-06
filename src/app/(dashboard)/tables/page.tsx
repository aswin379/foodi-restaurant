import type { Metadata } from "next"
import Link from "next/link"
import { QrCode } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { TablesView } from "@/features/locations/components/tables-view"

export const metadata: Metadata = {
  title: "Tables",
}

export default function TablesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Tables"
        description="Your restaurant's tables. Add, rename or switch them off in Locations & QR."
        actions={
          <Button asChild variant="outline">
            <Link href="/locations">
              <QrCode aria-hidden />
              Locations &amp; QR
            </Link>
          </Button>
        }
      />
      <TablesView />
    </div>
  )
}
