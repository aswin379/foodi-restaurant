"use client"

import { useEffect, useState } from "react"

export type DonutSegment = { label: string; count: number; color: string }

const SIZE = 132
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A donut of the same counts the status list beside it states (decorative, so hidden from assistive
 * technology). Each arc is sized by its share of the total and draws in once, with a CSS transition.
 */
export default function StatusDonut({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  let offset = 0
  return (
    <svg aria-hidden viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-[132px] shrink-0 -rotate-90">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-muted" />
      {total > 0
        ? segments
            .filter((segment) => segment.count > 0)
            .map((segment) => {
              const length = (segment.count / total) * CIRCUMFERENCE
              const gap = Math.min(3, length)
              const arc = (
                <circle
                  key={segment.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  stroke={segment.color}
                  strokeDasharray={`${drawn ? length - gap : 0} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-offset}
                  className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
                />
              )
              offset += length
              return arc
            })
        : null}
    </svg>
  )
}
