import { DashboardShell } from "@/components/dashboard/dashboard-shell"

// Authentication guard goes here (or in proxy.ts) once the Foodi session
// contract exists. Until then this area is an unprotected development preview.
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <DashboardShell>{children}</DashboardShell>
}
