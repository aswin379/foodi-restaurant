"use client"

import { useEffect, useState } from "react"

/**
 * The current time, refreshed every `intervalMs` and again whenever
 * `syncKey` changes (e.g. after new data arrives), so a just-changed order
 * never shows a stale timer. Null during server rendering and the first
 * client render, so timers never cause a hydration mismatch; callers render a
 * neutral placeholder until it's set.
 */
export function useNow(intervalMs = 30_000, syncKey?: unknown): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [intervalMs, syncKey])

  return now
}
