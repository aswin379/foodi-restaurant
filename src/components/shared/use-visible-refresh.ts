"use client"

import { useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"

/** PRD §7: polling fallback interval until real-time transport exists. */
export const REFRESH_INTERVAL_MS = 15_000

/**
 * Re-fetches the page's server data every `intervalMs` while the tab is
 * visible (and `enabled`), and once more when the tab becomes visible again.
 * Hidden tabs don't poll. A refresh isn't started while the previous one is
 * still running, so requests can't pile up. Timers and listeners are removed
 * on unmount. It only reads: it never changes orders or preview data.
 * Shared by the Orders board (B1) and the dashboard (B5a).
 */
export function useVisibleRefresh(enabled = true, intervalMs = REFRESH_INTERVAL_MS) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  useEffect(() => {
    if (!enabled) return
    const refresh = () => {
      if (document.visibilityState !== "visible" || pendingRef.current) return
      startTransition(() => router.refresh())
    }
    const timer = setInterval(refresh, intervalMs)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [enabled, intervalMs, router])
}
