import { availabilityLabels } from "@/lib/menu/labels"
import type { MenuAvailability } from "@/lib/menu/types"
import { cn } from "@/lib/utils"

export function AvailabilityBadge({ availability }: { availability: MenuAvailability }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        availability === "available"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-stone-200 bg-stone-100 text-stone-600"
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {availabilityLabels[availability]}
    </span>
  )
}
