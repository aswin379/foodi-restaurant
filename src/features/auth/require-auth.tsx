"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "./auth-context"
import { authApi } from "@/features/auth/auth-api"

/**
 * Keeps signed-out visitors off the dashboard. This is a convenience only: the API checks the
 * token, the owner and the restaurant on every request.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()
  const refreshedRef = useRef(false)

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login")
    } else if (status === "authenticated" && typeof document !== "undefined") {
      if (!document.cookie.includes("foodi_seller_token") && !refreshedRef.current) {
        refreshedRef.current = true
        authApi.refresh().then(() => {
          router.refresh()
        }).catch(() => {})
      }
    }
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
