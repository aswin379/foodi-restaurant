import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** The shared surface for whole-page error and not-found states. */
export function ErrorCard({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  tone?: "neutral" | "danger"
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl bg-card px-6 py-12 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:px-10",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-14 place-items-center rounded-full",
          tone === "danger" ? "bg-danger-soft text-danger-foreground" : "bg-primary-soft text-primary-text"
        )}
      >
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}
