import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-sage-line bg-gradient-to-b from-sage-soft/50 to-peach-soft/40 px-6 py-10 text-center",
        className
      )}
    >
      {/* Layered discs: a peach halo behind a sage tile. */}
      <span aria-hidden className="relative grid size-16 place-items-center">
        <span className="absolute inset-0 rounded-full bg-peach-soft ring-1 ring-peach-line" />
        <span className="relative grid size-11 place-items-center rounded-2xl bg-card text-sage-foreground shadow-sm ring-1 ring-sage-line">
          <Icon className="size-5" />
        </span>
      </span>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
