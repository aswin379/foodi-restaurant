"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { dashboardNavigation, isNavItemActive, type NavItem } from "./navigation"

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
  return (
    <nav aria-label="Restaurant admin" className="flex flex-col gap-5">
      {dashboardNavigation.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <h2
            className={cn(
              "px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
              collapsed && "sr-only"
            )}
          >
            {group.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.title}>
                <SidebarNavItem
                  item={item}
                  active={
                    item.href && pathname ? isNavItemActive(item.href, pathname) : false
                  }
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

const itemBase =
  "group flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

function SidebarNavItem({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
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
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/75 hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-[18px] shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.title}</span>
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={cn(
        itemBase,
        "cursor-not-allowed text-muted-foreground/80",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0 text-muted-foreground/70" />
      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
        {item.title}
        <span className="sr-only"> (coming soon)</span>
      </span>
      {!collapsed ? (
        <Badge
          aria-hidden
          variant="outline"
          className="rounded-full px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
        >
          Soon
        </Badge>
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
