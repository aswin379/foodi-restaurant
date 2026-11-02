import type { Metadata } from "next"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { RequireAuth } from "@/features/auth/require-auth"
import { RequireOwner } from "@/features/auth/require-owner"
import { noIndex } from "@/lib/seo"

export const metadata: Metadata = { robots: noIndex }

// Owner-level pages (My Restaurants, Add Restaurant): signed-in owners only, no restaurant needed.
// Same shell as the dashboard; sidebar links that need an approved restaurant redirect to My restaurants.
export default function OwnerLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <DashboardShell>
        <RequireOwner>{children}</RequireOwner>
      </DashboardShell>
    </RequireAuth>
  )
}
