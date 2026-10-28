import {
  BadgePercent,
  Bike,
  CalendarClock,
  ChartColumn,
  Clock,
  Contact,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  ReceiptText,
  Settings,
  Star,
  Store,
  Tags,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  icon: LucideIcon
  // null = module not built yet. The item renders as a disabled
  // "Soon" entry instead of linking to a page that doesn't exist.
  href: string | null
  /** Module number in the PRD module map (PRD v0.3 §1). */
  prdModule: number
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const DASHBOARD_HOME = "/dashboard"

// Release 1 modules from the PRD module map. POS (10), QR dine-in (11) and
// multi-outlet (21) are Release 2 and P1 is still unresolved, so they're not
// listed at all.
export const dashboardNavigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: DASHBOARD_HOME, prdModule: 2 }],
  },
  {
    label: "Operations",
    items: [
      { title: "Orders", icon: ReceiptText, href: "/orders", prdModule: 3 },
      { title: "Menu", icon: UtensilsCrossed, href: "/menu", prdModule: 4 },
      { title: "Categories", icon: Tags, href: "/menu/categories", prdModule: 4 },
      { title: "Meal periods", icon: CalendarClock, href: "/menu/meal-periods", prdModule: 4 },
      { title: "Availability & hours", icon: Clock, href: "/hours", prdModule: 5 },
      { title: "Delivery", icon: Bike, href: null, prdModule: 9 },
      { title: "Promotions", icon: BadgePercent, href: null, prdModule: 12 },
    ],
  },
  {
    label: "Restaurant",
    items: [
      { title: "Restaurant profile", icon: Store, href: "/settings/profile", prdModule: 18 },
      { title: "Settings", icon: Settings, href: "/settings", prdModule: 18 },
      { title: "Staff & roles", icon: Users, href: null, prdModule: 20 },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Reports", icon: ChartColumn, href: null, prdModule: 16 },
      { title: "Wallet & settlements", icon: Wallet, href: null, prdModule: 17 },
      { title: "Plan & billing", icon: CreditCard, href: null, prdModule: 19 },
      { title: "Reviews", icon: Star, href: "/reviews", prdModule: 13 },
      { title: "Customers", icon: Contact, href: "/customers", prdModule: 14 },
    ],
  },
  {
    label: "Help",
    items: [{ title: "Support", icon: LifeBuoy, href: null, prdModule: 22 }],
  },
]

export function isNavItemActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The most specific matching item, so /menu/categories selects "Categories", not "Menu". */
export function getActiveNavItem(pathname: string) {
  let active: NavItem | null = null
  for (const group of dashboardNavigation) {
    for (const item of group.items) {
      if (
        item.href &&
        isNavItemActive(item.href, pathname) &&
        item.href.length > (active?.href?.length ?? 0)
      ) {
        active = item
      }
    }
  }
  return active
}
