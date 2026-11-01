import type { SellerUser } from "@/features/auth/types"

// The permission that shows each dashboard link to staff. Owners see everything. A link that is not listed
// here (Staff & roles, My restaurants) is owner-only. The longest matching prefix wins, so /menu/categories
// needs "categories", not "menu". This only decides what the UI shows: the API checks the
// permission on every request, and pages without a staff-capable API are listed in docs/seller-staff.md.
const PERMISSION_BY_HREF: Record<string, string> = {
  "/dashboard": "dashboard",
  "/pos": "pos",
  "/orders": "orders",
  "/menu": "menu",
  "/menu/categories": "categories",
  "/menu/meal-periods": "meal-periods",
  "/hours": "hours",
  "/kitchen": "kitchen",
  "/tables": "tables",
  "/delivery": "delivery",
  "/promotions": "promotions",
  "/settings/profile": "profile",
  "/branches": "branches",
  "/settings": "settings",
  "/reports": "reports",
  "/wallet": "wallet",
  "/billing": "billing",
  "/reviews": "reviews",
  "/customers": "customers",
}

// Links that are not built yet have no href; they are matched by title.
const PERMISSION_BY_TITLE: Record<string, string> = {
  Support: "support",
}

export function isStaff(user: SellerUser | null): boolean {
  return user?.role === "staff"
}

/** The permission a staff member needs for this path or "Soon" title; undefined means owner-only. */
export function permissionFor(href: string | null, title?: string): string | undefined {
  if (href === null) return title ? PERMISSION_BY_TITLE[title] : undefined
  let best: string | undefined
  for (const prefix of Object.keys(PERMISSION_BY_HREF)) {
    if ((href === prefix || href.startsWith(`${prefix}/`)) && prefix.length > (best?.length ?? -1)) best = prefix
  }
  return best === undefined ? undefined : PERMISSION_BY_HREF[best]
}

export function canSeeArea(user: SellerUser | null, href: string | null, title?: string): boolean {
  if (!user || user.role !== "staff") return true
  const needed = permissionFor(href, title)
  return needed !== undefined && (user.permissions ?? []).includes(needed)
}
