"use client"

import { Suspense, useId } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { m } from "framer-motion"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/features/auth/auth-context"
import { canSeeArea } from "@/features/staff/access"
import { cn } from "@/lib/utils"

import { dashboardNavigation, getActiveNavItem, type NavItem } from "./navigation"

type SidebarNavProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

// The pathname is request data on dynamic routes (e.g. /orders/[orderId]), so
// it is read inside Suspense; the fallback is the same nav with nothing active.
export function SidebarNav(props: SidebarNavProps) {
  return (
    <Suspense fallback={<SidebarNavList {...props} pathname={null} />}>
      <SidebarNavForCurrentPath {...props} />
    </Suspense>
  )
}

function SidebarNavForCurrentPath(props: SidebarNavProps) {
  return <SidebarNavList {...props} pathname={usePathname()} />
}

function SidebarNavList({
  collapsed = false,
  onNavigate,
  pathname,
}: SidebarNavProps & { pathname: string | null }) {
  const activeItem = pathname ? getActiveNavItem(pathname) : null
  // The desktop rail and the mobile sheet each render this list; separate ids stop their indicators sharing a layout.
  const indicatorId = useId()
  const { user } = useAuth()
  // Staff only see links they hold the permission for (Soon placeholders included); empty groups disappear.
  // Cosmetic: the API enforces access.
  const groups = dashboardNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeArea(user, item.href, item.title)),
    }))
    .filter((group) => group.items.length > 0)
  return (
    <nav aria-label="Restaurant admin" className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          {/* Group names stay as real headings for screen readers; visually they are quiet labels,
              and on the collapsed rail a hairline replaces them. */}
          <h2
            className={cn(
              "px-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase",
              collapsed && "sr-only"
            )}
          >
            {group.label}
          </h2>
          {collapsed && index > 0 ? <span aria-hidden className="mx-3 -mt-3 mb-1 h-px bg-border-soft" /> : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.title}>
                <SidebarNavItem
                  item={item}
                  active={item === activeItem}
                  indicatorId={indicatorId}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

// 40px rows (44px on tall screens), 20px icons. The active row is a soft peach pill (a shared-layout
// indicator that slides between rows) with brand-coloured text, so orange stays an accent, not a block.
const itemBase =
  "group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium outline-none transition-colors [@media(min-height:1000px)]:h-11"

function SidebarNavItem({
  item,
  active,
  indicatorId,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  indicatorId: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const content = item.href ? (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemBase,
        active ? "font-semibold text-primary-text" : "text-foreground/80 hover:bg-primary-faint hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      {active ? (
        <m.span
          layoutId={indicatorId}
          aria-hidden
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-xl border border-primary-line bg-primary-soft"
        >
          <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-primary" />
        </m.span>
      ) : null}
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn(
          "relative size-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      <span className={cn("relative truncate", collapsed && "sr-only")}>{item.title}</span>
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={cn(
        itemBase,
        "cursor-not-allowed text-muted-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-faint-foreground" />
      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
        {item.title}
        <span className="sr-only"> (coming soon)</span>
      </span>
      {!collapsed ? (
        <span
          aria-hidden
          className="rounded-full border border-neutral-line bg-neutral-soft px-2 py-px text-[10px] font-semibold text-neutral-foreground"
        >
          Soon
        </span>
      ) : null}
    </span>
  )

  if (!collapsed) return content

  // Collapsed rail: disabled items aren't focusable, so they get a hover-only
  // tooltip; their names stay available to screen readers via sr-only text.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.href ? item.title : `${item.title} · Coming soon`}
      </TooltipContent>
    </Tooltip>
  )
}
