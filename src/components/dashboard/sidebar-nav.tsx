"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  return (
    <nav aria-label="Restaurant admin" className="flex flex-col gap-5">
      {dashboardNavigation.map((group, index) => (
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

// 40px rows (44px on tall screens), 20px icons. The active row is a solid brand pill with white text.
const itemBase =
  "group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium outline-none transition-colors [@media(min-height:1000px)]:h-11"

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
          ? "bg-primary font-semibold text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/28%)]"
          : "text-foreground/80 hover:bg-primary-faint hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn(
          "size-5 shrink-0",
          active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.title}</span>
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
