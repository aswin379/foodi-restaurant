import Link from "next/link"

import { cn } from "@/lib/utils"

const VIEWS = [
  { id: "active", label: "Active deliveries", href: "/delivery" },
  { id: "history", label: "Delivery history", href: "/delivery?view=history" },
] as const

/** Switches between the live delivery board and the delivery history. */
export function DeliveryNav({ current }: { current: (typeof VIEWS)[number]["id"] }) {
  return (
    <nav aria-label="Delivery views">
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-card p-1 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        {VIEWS.map((view) => (
          <li key={view.id}>
            <Link
              href={view.href}
              aria-current={view.id === current ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                view.id === current
                  ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]"
                  : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              {view.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
