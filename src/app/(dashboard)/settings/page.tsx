import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Clock, ReceiptText, Store } from "lucide-react"

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
      <PageHeader
        variant="hero"
        title="Settings"
        description="How your restaurant appears and how it takes orders."
        actions={<SettingsNav current="/settings" />}
      />
      <ul className="grid gap-3 md:grid-cols-3" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="group flex h-full items-start gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] outline-none transition-shadow hover:shadow-[0_12px_36px_rgb(214_63_8/16%)] focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-6"
            >
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/30%)]">
                <section.icon className="size-6" strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-lg font-semibold">{section.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{section.description}</span>
              </span>
              <span aria-hidden className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
