import type { LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"

type StatCardProps = {
  title: string
  icon: LucideIcon
  /** Formatted value from a real data source; null renders an empty state. */
  value: string | null
  emptyHint?: string
}

export function StatCard({
  title,
  icon: Icon,
  value,
  emptyHint = "No data yet",
}: StatCardProps) {
  return (
    <Card className="gap-0 rounded-xl px-4 py-4 shadow-none sm:px-5 sm:py-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      {value !== null ? (
        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      ) : (
        <>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-muted-foreground/60">
            <span aria-hidden>—</span>
            <span className="sr-only">No value</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
        </>
      )}
    </Card>
  )
}
