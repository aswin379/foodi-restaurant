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
import { MotionProvider } from "@/components/motion/motion-provider"
import { Notifications } from "@/components/shared/notifications"
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
        className="sr-only z-50 rounded-lg bg-card px-3 py-2 text-sm font-semibold shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-none"
      >
        Skip to content
      </a>
      <MotionProvider>
      <div className="app-backdrop flex min-h-dvh">
        <aside
          id="dashboard-sidebar"
          aria-label="Sidebar"
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 p-4 transition-[width] duration-200 lg:block",
            collapsed ? "w-[108px]" : "w-[288px]"
          )}
        >
          <div className="surface-card h-full overflow-hidden rounded-3xl bg-card">
            <SidebarContent collapsed={collapsed} />
          </div>
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[280px] max-w-[85vw] gap-0 p-0">
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
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
              <DevelopmentNotice />
              {children}
            </div>
          </main>
        </div>
      </div>
      </MotionProvider>
      <Notifications />
    </TooltipProvider>
  )
}

// Remove once the other dashboard sections show live restaurant data.
function DevelopmentNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-warning-line bg-warning-soft px-4 py-2.5 text-xs leading-relaxed text-warning-foreground"
    >
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Development preview.</span> Only
        sign-in and Branches use live restaurant data. The other sections are
        still previews.
      </p>
    </div>
  )
}
