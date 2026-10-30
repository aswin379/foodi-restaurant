"use client"

import { Suspense, startTransition } from "react"
import { usePathname } from "next/navigation"
import {
  Bell,
  ChevronDown,
  CircleUser,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 bg-background/60 px-4 backdrop-blur-md sm:px-6 lg:px-10">
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

      {/* Pathname is request data on dynamic routes, so it's read inside Suspense. */}
      <Suspense fallback={<span className="min-w-0 flex-1" />}>
        <CurrentPageTitle />
      </Suspense>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NotificationsPopover />
        <AccountMenu />
      </div>
    </header>
  )
}

function CurrentPageTitle() {
  const title = getActiveNavItem(usePathname())?.title ?? "Dashboard"
  return <p className="min-w-0 truncate text-base font-semibold text-foreground">{title}</p>
}

// A popover, not a menu: it holds a message, not a list of actions, so it has no menu semantics to get wrong.
// It is non-modal, so opening it never hides the rest of the page from assistive technology.
function NotificationsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="rounded-full bg-card text-muted-foreground shadow-xs hover:bg-primary-faint">
          <Bell aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Notifications" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Notifications</p>
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary-text">
            <Bell aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm font-semibold">No notifications</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Order and account alerts will appear here once your restaurant is connected.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AccountMenu() {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Account menu" className="gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-foreground shadow-xs hover:bg-primary-faint">
          <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary-text">
            <CircleUser aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
          <span className="hidden text-sm font-semibold sm:inline">Account</span>
          <ChevronDown aria-hidden className="hidden size-4 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold">Account</p>
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
