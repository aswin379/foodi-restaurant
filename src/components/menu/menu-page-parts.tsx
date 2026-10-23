import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

export function BackToMenuLink() {
  return (
    <Link
      href="/menu"
      className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to menu
    </Link>
  )
}

export function MenuFormSkeleton() {
  return (
    <div role="status" aria-label="Loading form" className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-96 rounded-xl lg:col-span-2" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
