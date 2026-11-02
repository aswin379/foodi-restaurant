"use client"

import Link from "next/link"
import { Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "./auth-context"

/**
 * Gates owner-only pages (e.g. restaurant applications and owner restaurant lists)
 * so staff members see a clear explanation and a way back to their dashboard.
 */
export function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (user?.role === "staff") {
    return (
      <div
        role="alert"
        className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-8 text-center"
      >
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock aria-hidden className="size-5" />
        </span>
        <p className="font-semibold text-foreground">Restaurant owners only</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Only restaurant owners can view all restaurants or apply for new ones. Staff members can manage their assigned restaurants from the dashboard.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

