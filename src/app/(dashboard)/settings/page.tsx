import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Clock, ReceiptText, Store } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"

export const metadata: Metadata = {
  title: "Settings",
}

const SECTIONS = [
  {
    href: "/settings/profile",
    icon: Store,
    title: "Restaurant profile",
    description: "Name, description, contact details, address and location, logo and cover image.",
  },
  {
    href: "/settings/orders",
    icon: ReceiptText,
    title: "Order settings",
    description: "Order types offered, minimum order, default prep times and the pickup code.",
  },
  {
    href: "/hours",
    icon: Clock,
    title: "Availability & hours",
    description: "Weekly hours, special dates and pausing new orders.",
  },
] as const

/** Settings overview (B4a): links only, so it shows no data of its own. */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="How your restaurant appears and how it takes orders." />
      <SettingsNav current="/settings" />
      <ul className="grid gap-3 md:grid-cols-3" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <section.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{section.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{section.description}</span>
              </span>
              <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
