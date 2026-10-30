"use client"

import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { ErrorCard } from "@/components/shared/error-card"
import { Button } from "@/components/ui/button"

// Error boundary inside the dashboard shell, so the navigation stays available. No cause is shown.
export default function DashboardError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorCard
      icon={TriangleAlert}
      tone="danger"
      title="Something went wrong"
      description="We couldn't show this page. Nothing you did has been lost or changed. Try again, or go back to the dashboard."
      className="my-10"
    >
      <Button type="button" onClick={() => retry()}>
        Try again
      </Button>
      <Button asChild variant="outline">
        <Link href="/dashboard">Go to the dashboard</Link>
      </Button>
    </ErrorCard>
  )
}
