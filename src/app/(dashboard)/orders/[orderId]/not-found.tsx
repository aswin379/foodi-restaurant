import Link from "next/link"
import { SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function OrderNotFound() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <h1 className="mt-3 text-sm font-medium">Order not found</h1>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        This order doesn&apos;t exist or isn&apos;t available to your restaurant.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/orders">Back to the orders board</Link>
      </Button>
    </div>
  )
}
