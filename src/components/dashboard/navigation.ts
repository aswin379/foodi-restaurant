import {
  Bike,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Store,
  Tags,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  icon: LucideIcon
  // null = module not built yet. The item renders as a disabled
  // "Soon" entry instead of linking to a page that doesn't exist.
  href: string | null
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const DASHBOARD_HOME = "/dashboard"

export const dashboardNavigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: DASHBOARD_HOME }],
  },
  {
    label: "Operations",
    items: [
      { title: "Orders", icon: ReceiptText, href: null },
      { title: "Menu Management", icon: UtensilsCrossed, href: null },
      { title: "Categories", icon: Tags, href: null },
      { title: "Delivery Management", icon: Bike, href: null },
    ],
  },
  {
    label: "Restaurant",
    items: [
      { title: "Restaurant Profile", icon: Store, href: null },
      { title: "Staff", icon: Users, href: null },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Subscription & Billing", icon: CreditCard, href: null },
      { title: "Reports & Analytics", icon: ChartColumn, href: null },
      { title: "Settings", icon: Settings, href: null },
    ],
  },
]

export function isNavItemActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getActiveNavItem(pathname: string) {
  for (const group of dashboardNavigation) {
    for (const item of group.items) {
      if (item.href && isNavItemActive(item.href, pathname)) return item
    }
  }
  return null
}
