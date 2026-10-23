"use client"

import { startTransition } from "react"
import { usePathname } from "next/navigation"
import {
  Bell,
  CircleUser,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth/sign-out"

import { getActiveNavItem } from "./navigation"

type DashboardHeaderProps = {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileNav: () => void
}

export function DashboardHeader({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
}: DashboardHeaderProps) {
  const pathname = usePathname()
  const title = getActiveNavItem(pathname)?.title ?? "Dashboard"

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-2 lg:hidden"
      >
        <Menu aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!sidebarCollapsed}
        aria-controls="dashboard-sidebar"
        className="-ml-2 hidden text-muted-foreground lg:inline-flex"
      >
        {sidebarCollapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
      </Button>

      <p className="min-w-0 truncate text-[15px] font-semibold text-foreground">
        {title}
      </p>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <RestaurantIdentity />
        <NotificationsMenu />
        <AccountMenu />
      </div>
    </header>
  )
}

// Placeholder until restaurant identity comes from an authenticated session.
function RestaurantIdentity() {
  return (
    <div className="mr-1 hidden items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5 md:flex">
      <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
        <Store aria-hidden className="size-4" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium">Your restaurant</span>
        <span className="text-xs text-muted-foreground">Not connected</span>
      </span>
    </div>
  )
}

function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="text-muted-foreground"
        >
          <Bell aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <DropdownMenuLabel className="border-b px-4 py-3">
          Notifications
        </DropdownMenuLabel>
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <Bell aria-hidden className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No notifications</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Order and account alerts will appear here once your restaurant is
            connected.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Account menu"
          className="gap-2 px-2 text-muted-foreground"
        >
          <CircleUser aria-hidden className="size-5" />
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            Account
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">Account</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Your account details will appear here once sign-in is connected.
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Settings aria-hidden />
          Account settings
          <span className="ml-auto text-xs text-muted-foreground">Soon</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
