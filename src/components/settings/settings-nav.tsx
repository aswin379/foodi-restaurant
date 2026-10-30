import Link from "next/link"

import { cn } from "@/lib/utils"

const SECTIONS = [
  { href: "/settings", label: "Overview" },
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/orders", label: "Order settings" },
] as const

/** Links between the settings pages; the current one is marked for assistive technology. */
export function SettingsNav({ current }: { current: (typeof SECTIONS)[number]["href"] }) {
  return (
    <nav aria-label="Settings sections">
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-card p-1 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              aria-current={section.href === current ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-5",
                section.href === current
                  ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]"
                  : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
