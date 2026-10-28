import Link from "next/link"
import { Clock, ReceiptText, Settings, Store, UtensilsCrossed } from "lucide-react"

import { DashboardSection } from "./dashboard-section"

/** Shortcuts to existing screens only (B5a); nothing here is a placeholder. */
export const QUICK_LINKS = [
  { title: "Orders", description: "Accept and track incoming orders", href: "/orders", icon: ReceiptText },
  { title: "Menu", description: "Dishes, prices and sold-out items", href: "/menu", icon: UtensilsCrossed },
  { title: "Availability and hours", description: "Opening hours, special dates and pause", href: "/hours", icon: Clock },
  { title: "Restaurant profile", description: "Name, contact details, address and images", href: "/settings/profile", icon: Store },
  { title: "Order settings", description: "Order types, minimum order and prep times", href: "/settings/orders", icon: Settings },
] as const

export function QuickLinks() {
  return (
    <DashboardSection id="quick-links" title="Quick links" description="Shortcuts to common tasks.">
      <ul className="flex flex-col gap-2">
        {QUICK_LINKS.map(({ title, description, href, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
