"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"

import { dashboardNavigation } from "@/components/dashboard/navigation"
import { useAuth } from "@/features/auth/auth-context"

import { canSeeArea } from "../access"

/**
 * A staff member who opens a page by URL without its permission sees this instead of the page. Cosmetic:
 * the API refuses the data anyway, so this just avoids showing a page that can only fail.
 */
export function AreaGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  if (user?.role !== "staff" || canSeeArea(user, pathname)) return <>{children}</>

  const first = dashboardNavigation.flatMap((g) => g.items).find((item) => item.href && canSeeArea(user, item.href, item.title))
  return (
    <div role="alert" className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-8 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock aria-hidden className="size-5" />
      </span>
      <p className="font-medium">You do not have access to this page</p>
      <p className="max-w-sm text-sm text-muted-foreground">Ask the restaurant owner to give you access.</p>
      {first?.href ? (
        <Link href={first.href} className="text-sm font-medium text-primary-text underline underline-offset-4">
          Go to {first.title}
        </Link>
      ) : null}
    </div>
  )
}
