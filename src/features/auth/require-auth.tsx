"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "./auth-context"

/**
 * Keeps signed-out visitors off the dashboard. This is a convenience only: the API checks the
 * token, the owner and the restaurant on every request.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "anonymous") router.replace("/login")
  }, [status, router])

  if (status !== "authenticated") {
    return (
      <div
        role="status"
        className="grid min-h-dvh place-items-center text-muted-foreground"
      >
        <Loader2 aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }
  return children
}
