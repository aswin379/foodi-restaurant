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
      <ul className="flex w-fit gap-1 rounded-full bg-card p-1 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
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
