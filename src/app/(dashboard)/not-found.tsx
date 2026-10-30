import Link from "next/link"
import { SearchX } from "lucide-react"

import { ErrorCard } from "@/components/shared/error-card"
import { Button } from "@/components/ui/button"

export default function DashboardNotFound() {
  return (
    <ErrorCard icon={SearchX} title="Page not found" description="We couldn't find that page. It may have moved, or the address may be wrong." className="my-10">
      <Button asChild>
        <Link href="/dashboard">Go to the dashboard</Link>
      </Button>
    </ErrorCard>
  )
}
