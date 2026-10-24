import Link from "next/link"

import { cn } from "@/lib/utils"

const SECTIONS = [
  { href: "/hours", label: "Weekly hours" },
  { href: "/hours/special-dates", label: "Special dates" },
] as const

/** Links between the two hours pages; the current one is marked for assistive technology. */
export function HoursNav({ current }: { current: (typeof SECTIONS)[number]["href"] }) {
  return (
    <nav aria-label="Hours sections">
      <ul className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              aria-current={section.href === current ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                section.href === current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
