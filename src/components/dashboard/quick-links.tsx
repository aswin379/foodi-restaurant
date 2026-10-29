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

export function QuickLinks({ className }: { className?: string }) {
  return (
    <DashboardSection id="quick-links" title="Quick links" description="Shortcuts to common tasks." className={className}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {QUICK_LINKS.map(({ title, description, href, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full items-center gap-3 rounded-2xl border border-border-soft bg-background/60 p-3 outline-none transition-[border-color,background-color] hover:border-primary-line hover:bg-primary-faint"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon aria-hidden strokeWidth={1.75} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
