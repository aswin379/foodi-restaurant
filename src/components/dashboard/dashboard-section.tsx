import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * A titled dashboard region. `card` is a rounded surface; `plain` is a heading
 * with its content directly on the page (used for the KPI tiles, which are
 * cards themselves). `badge` sits next to the title (e.g. the preview label)
 * and `action` at the far end of the heading row (e.g. "See all orders").
 * Both are named regions: the accessible name is the heading.
 */
export function DashboardSection({
  id,
  title,
  description,
  badge,
  action,
  variant = "card",
  flush = false,
  className,
  children,
}: {
  id: string
  title: string
  description: string
  badge?: React.ReactNode
  action?: React.ReactNode
  variant?: "card" | "plain"
  /** Lets a table run edge to edge inside a card. */
  flush?: boolean
  className?: string
  children: React.ReactNode
}) {
  const heading = (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", variant === "card" && "px-6")}>
      <div className="min-w-0">
        <h2 id={`${id}-title`} className="flex flex-wrap items-center gap-2 text-lg leading-7 font-semibold">
          {title}
          {badge}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )

  if (variant === "plain") {
    return (
      <section aria-labelledby={`${id}-title`} className={cn("flex flex-col gap-4", className)}>
        {heading}
        {children}
      </section>
    )
  }

  return (
    <Card className={cn("gap-5 rounded-3xl border-transparent py-6 shadow-[0_8px_30px_rgb(31_26_23/6%)]", className)} aria-labelledby={`${id}-title`} role="region">
      {heading}
      <div className={cn(flush ? "" : "px-6")}>{children}</div>
    </Card>
  )
}
