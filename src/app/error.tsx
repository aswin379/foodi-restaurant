"use client"

import Image from "next/image"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { ErrorCard } from "@/components/shared/error-card"
import { Button } from "@/components/ui/button"

// Error boundary for the whole app. It says nothing about the cause: details stay in the server logs.
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-gradient-to-br from-background to-background-warm px-5 py-10">
      <Image src="/brand/foodi-logo.png" alt="Foodi" width={1953} height={493} priority className="h-9 w-auto" />
      <ErrorCard
        icon={TriangleAlert}
        tone="danger"
        title="Something went wrong"
        description="We couldn't show this page. Nothing you did has been lost or changed. Try again, or go back to the dashboard."
      >
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to the dashboard</Link>
        </Button>
      </ErrorCard>
    </main>
  )
}
