"use client"

import { LazyMotion, MotionConfig } from "framer-motion"

// The animation engine is fetched after first paint, so it never blocks the initial render.
// domMax (not domAnimation) because the sidebar's sliding indicator needs layout animation.
const loadFeatures = () => import("./features").then((module) => module.default)

/** Provides lazily loaded Framer Motion features; reduced-motion users get no transform animation. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
