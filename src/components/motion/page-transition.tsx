"use client"

import { m } from "framer-motion"

/** Fades each page in. Used by (dashboard)/template.tsx, which remounts on every navigation. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </m.div>
  )
}
