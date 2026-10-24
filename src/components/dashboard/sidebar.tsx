"use client"

import Image from "next/image"
import Link from "next/link"
import { LogOut } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { signOut } from "@/lib/auth/sign-out"
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
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 px-5",
          collapsed && "justify-center px-0"
        )}
      >
        <Link
          href={DASHBOARD_HOME}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* Collapsed rail crops the wordmark to its "F" rather than altering the asset. */}
          <span
            className={cn(
              "block overflow-hidden",
              collapsed ? "w-[22px]" : "w-auto"
            )}
          >
            <Image
              src="/brand/foodi-logo.png"
              alt="Foodi"
              width={1953}
              height={493}
              priority
              className="h-7 w-auto max-w-none"
            />
          </span>
          <span
            className={cn(
              "border-l border-border pl-3 text-xs leading-tight font-medium text-muted-foreground",
              collapsed && "sr-only"
            )}
          >
            Restaurant
            <br />
            Portal
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 px-3 pb-4">
        <Separator className="mb-3" />
        <SignOutButton collapsed={collapsed} />
      </div>
    </div>
  )
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const button = (
    <button
      type="submit"
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground/75 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        collapsed && "justify-center px-0"
      )}
    >
      <LogOut aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
      <span className={cn(collapsed && "sr-only")}>Log out</span>
    </button>
  )

  return (
    <form action={signOut}>
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
    </form>
  )
}
