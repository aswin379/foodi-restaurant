import {
  BadgePercent,
  Bike,
  CalendarClock,
  ChartColumn,
  ChefHat,
  Clock,
  Contact,
  Armchair,
  CreditCard,
  LayoutDashboard,
  MonitorSmartphone,
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
  /** Sub-links shown in a dropdown under the item. The item keeps its own href (the collapsed rail links to it). */
  children?: NavChild[]
}

export type NavChild = {
  title: string
  /** May carry a query (e.g. "/delivery?view=history"); it then counts as active only while the query matches. */
  href: string
  /** Shown only while the restaurant delivers its own orders (delivery mode "We deliver ourselves"). */
  requiresOwnDelivery?: boolean
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
      { title: "POS", icon: MonitorSmartphone, href: "/pos", prdModule: 10 },
      { title: "Orders", icon: ReceiptText, href: "/orders", prdModule: 3 },
      { title: "Menu", icon: UtensilsCrossed, href: "/menu", prdModule: 4 },
      { title: "Categories", icon: Tags, href: "/menu/categories", prdModule: 4 },
      { title: "Meal periods", icon: CalendarClock, href: "/menu/meal-periods", prdModule: 4 },
      { title: "Availability & hours", icon: Clock, href: "/hours", prdModule: 5 },
      { title: "Kitchen display", icon: ChefHat, href: "/kitchen", prdModule: 8 },
      { title: "Tables", icon: Armchair, href: "/tables", prdModule: 10 },
      {
        title: "Delivery",
        icon: Bike,
        href: "/delivery",
        prdModule: 9,
        children: [
          { title: "Activity", href: "/delivery" },
          { title: "History", href: "/delivery?view=history" },
          { title: "Delivery boys", href: "/delivery-boys", requiresOwnDelivery: true },
        ],
      },
      { title: "Promotions", icon: BadgePercent, href: "/promotions", prdModule: 12 },
    ],
  },
  {
    label: "Restaurant",
    items: [
      { title: "Restaurant profile", icon: Store, href: "/settings/profile", prdModule: 18 },
      { title: "Settings", icon: Settings, href: "/settings", prdModule: 18 },
      { title: "Staff & roles", icon: Users, href: "/staff", prdModule: 20 },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Reports", icon: ChartColumn, href: "/reports", prdModule: 16 },
      { title: "Wallet & settlements", icon: Wallet, href: "/wallet", prdModule: 17 },
      { title: "Plan & billing", icon: CreditCard, href: "/billing", prdModule: 19 },
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

/** The path part of an href that may carry a query. */
export const pathOf = (href: string) => href.split("?")[0] ?? href

/** The most specific matching item, so /menu/categories selects "Categories", not "Menu". Sub-links count for their parent. */
export function getActiveNavItem(pathname: string) {
  let active: NavItem | null = null
  let activeLength = 0
  for (const group of dashboardNavigation) {
    for (const item of group.items) {
      const paths = [item.href, ...(item.children ?? []).map((child) => pathOf(child.href))]
      for (const path of paths) {
        if (path && isNavItemActive(path, pathname) && path.length > activeLength) {
          active = item
          activeLength = path.length
        }
      }
    }
  }
  return active
}

/**
 * The sub-link that is open on this page. A sub-link with a query (History) wins while its query matches;
 * otherwise the one for the plain path (Activity) is active.
 */
export function getActiveChild(item: NavItem, pathname: string, searchParams: URLSearchParams | null) {
  const onPath = (item.children ?? []).filter((child) => isNavItemActive(pathOf(child.href), pathname))
  const queryMatch = onPath.find((child) => {
    const query = child.href.split("?")[1]
    if (!query) return false
    for (const [key, value] of new URLSearchParams(query)) if (searchParams?.get(key) !== value) return false
    return true
  })
  if (queryMatch) return queryMatch
  const plain = onPath.filter((child) => !child.href.includes("?"))
  return plain.sort((a, b) => b.href.length - a.href.length)[0] ?? null
}

/** Header title for owner-level pages that are not sidebar items (My restaurants, Add restaurant). */
export function getOwnerPageTitle(pathname: string) {
  if (pathname === "/restaurants") return "My restaurants"
  if (pathname === "/restaurants/new") return "Add restaurant"
  if (pathname.startsWith("/restaurants/")) return "Restaurant application"
  // Opened from the Tables page; not a sidebar item, so the header title comes from here.
  if (pathname === "/locations") return "Locations & QR"
  return null
}
