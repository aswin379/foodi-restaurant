import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  /** "hero" is the large greeting used by the dashboard. Every other page keeps the standard header. */
  variant?: "standard" | "hero"
}

export function PageHeader({ title, description, actions, variant = "standard" }: PageHeaderProps) {
  const hero = variant === "hero"
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1
          className={cn(
            "font-semibold tracking-tight text-foreground",
            hero ? "text-[1.75rem] leading-9 font-bold tracking-[-0.02em] sm:text-[2rem] sm:leading-10 lg:text-[2.5rem] lg:leading-[3rem]" : "text-2xl"
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className={cn("mt-1.5 leading-relaxed text-muted-foreground", hero ? "max-w-3xl" : "max-w-2xl", hero ? "text-[15px]" : "text-sm")}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  )
}
