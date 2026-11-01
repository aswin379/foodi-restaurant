import type { Metadata } from "next"

import { BranchList } from "@/features/branches/components/branch-list"

export const metadata: Metadata = {
  title: "Branches",
}

export default function BranchesPage() {
  return <BranchList />
}
