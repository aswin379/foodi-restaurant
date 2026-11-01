"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"

// The chart is decorative and below the headline figures, so its code loads on demand, client-side only.
const StatusDonut = dynamic(() => import("./status-donut"), {
  ssr: false,
  loading: () => <Skeleton aria-hidden className="size-[132px] shrink-0 rounded-full" />,
})

export { StatusDonut as LazyStatusDonut }
