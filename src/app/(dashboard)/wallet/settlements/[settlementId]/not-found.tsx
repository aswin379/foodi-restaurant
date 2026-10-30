import Link from "next/link"
import { SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function SettlementNotFound() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <h1 className="mt-3 text-sm font-medium">Settlement not found</h1>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        This settlement doesn&apos;t exist or isn&apos;t available to your restaurant.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/wallet/settlements">Back to settlements</Link>
      </Button>
    </div>
  )
}
