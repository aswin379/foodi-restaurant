import Link from "next/link"

import { ORDER_HISTORY_PATH } from "@/lib/orders/query"
import { cn } from "@/lib/utils"

const VIEWS = [
  { id: "board", label: "Live board", href: "/orders" },
  { id: "history", label: "Order history", href: ORDER_HISTORY_PATH },
] as const

/** Switches between the live board and the order history. */
export function OrdersSubnav({ current }: { current: (typeof VIEWS)[number]["id"] }) {
  return (
    <nav aria-label="Order views">
      <ul className="flex w-fit gap-1 rounded-lg border bg-card p-1">
        {VIEWS.map((view) => (
          <li key={view.id}>
            <Link
              href={view.href}
              aria-current={view.id === current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                view.id === current
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
