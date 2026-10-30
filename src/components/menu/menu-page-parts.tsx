import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

export function BackToMenuLink() {
  return (
    <Link
      href="/menu"
      className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        <ArrowLeft className="size-4" />
      </span>
      Back to menu
    </Link>
  )
}

export function MenuFormSkeleton() {
  return (
    <div role="status" aria-label="Loading form" className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-96 rounded-3xl lg:col-span-2" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  )
}
