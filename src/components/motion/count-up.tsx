"use client"

import { useEffect, useRef } from "react"

/**
 * A number that counts up from its previous value. The final value is the server-rendered text, so
 * nothing is wrong without JavaScript or with reduced motion. Plain rAF, so it adds no library.
 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const origin = from.current
    from.current = value
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      node.textContent = String(Math.round(origin + (value - origin) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  )
}
