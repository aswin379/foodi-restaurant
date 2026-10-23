"use client"

import { useState } from "react"
import { Info } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { DashboardHeader } from "./header"
import { SidebarContent } from "./sidebar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={150}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-muted/40">
        <aside
          id="dashboard-sidebar"
          aria-label="Sidebar"
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 border-r bg-background transition-[width] duration-200 lg:block",
            collapsed ? "w-[72px]" : "w-72"
          )}
        >
          <SidebarContent collapsed={collapsed} />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Restaurant admin sections
            </SheetDescription>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            sidebarCollapsed={collapsed}
            onToggleSidebar={() => setCollapsed((value) => !value)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <DevelopmentNotice />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

// Remove once the dashboard is protected by real authentication and data.
function DevelopmentNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-900 sm:px-6"
    >
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Development preview.</span> This area
        isn&apos;t protected by sign-in yet and doesn&apos;t show live
        restaurant data.
      </p>
    </div>
  )
}
