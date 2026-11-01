"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/features/auth/auth-context"
import { RestaurantSwitcher } from "@/features/restaurants/components/restaurant-switcher"
import { cn } from "@/lib/utils"

import { DASHBOARD_HOME } from "./navigation"
import { SidebarNav } from "./sidebar-nav"

type SidebarContentProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

/** Sidebar body shared by the desktop rail and the mobile sheet. */
export function SidebarContent({
  collapsed = false,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-20 shrink-0 items-center px-6", collapsed && "justify-center px-0")}>
        <Link
          href={DASHBOARD_HOME}
          onClick={onNavigate}
          className="flex flex-col gap-1 rounded-md outline-none"
        >
          {/* Collapsed rail crops the wordmark to its "F" rather than altering the asset. */}
          <span className={cn("block overflow-hidden", collapsed ? "w-[26px]" : "w-auto")}>
            <Image
              src="/brand/foodi-logo.png"
              alt="Foodi"
              width={1953}
              height={493}
              priority
              className="h-8 w-auto max-w-none"
            />
          </span>
          <span className={cn("text-xs font-medium text-muted-foreground", collapsed && "sr-only")}>
            Restaurant Portal
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className={cn("flex shrink-0 flex-col gap-1 border-t border-border-soft p-3", collapsed && "items-center px-2")}>
        <RestaurantSwitcher collapsed={collapsed} />
        <SignOutButton collapsed={collapsed} />
      </div>
    </div>
  )
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const { logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  const button = (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-foreground/80 outline-none transition-colors hover:bg-primary-faint hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <LogOut aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
      <span className={cn(collapsed && "sr-only")}>Log out</span>
    </button>
  )

  return (
    <div className="w-full">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Log out
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </div>
  )
}
