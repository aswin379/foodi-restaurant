import type { Metadata } from "next"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AreaGate } from "@/features/staff/components/area-gate"
import { ChangePasswordGate } from "@/features/staff/components/change-password-gate"
import { RequireAuth } from "@/features/auth/require-auth"
import { RequireRestaurant } from "@/features/restaurants/require-restaurant"
import { noIndex } from "@/lib/seo"

export const metadata: Metadata = { robots: noIndex }

// The access token lives only in browser memory, so the guard runs on the client. It only keeps
// signed-out visitors off the page; the API authorizes every request.
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <ChangePasswordGate>
        <RequireRestaurant>
          <DashboardShell>
            <AreaGate>{children}</AreaGate>
          </DashboardShell>
        </RequireRestaurant>
      </ChangePasswordGate>
    </RequireAuth>
  )
}
