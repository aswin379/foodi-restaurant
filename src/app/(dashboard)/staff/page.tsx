import type { Metadata } from "next"

import { StaffManager } from "@/features/staff/components/staff-manager"

export const metadata: Metadata = {
  title: "Staff & roles",
}

// Owner-only: the page loads its data from the staff API, which also refuses everyone but the owner.
export default function StaffPage() {
  return <StaffManager />
}
