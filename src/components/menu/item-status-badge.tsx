import { orderTypeLabels } from "@/lib/domain/order-types"
import { formatTime, type ZoneAndLocale } from "@/lib/orders/format"
import { dietaryLabels } from "@/lib/menu/labels"
import type { ItemStatus } from "@/lib/menu/rules"
import type { DietaryType, SoldOutUntil } from "@/lib/menu/types"
import { cn } from "@/lib/utils"

const pill =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

export function soldOutUntilText(until: SoldOutUntil, context: ZoneAndLocale) {
  if (until === "next_opening") return "until next opening"
  if (until === "end_of_day") return "until end of day"
  if (until === "manual") return "until switched back on"
  return `until ${formatTime(until.at, context)}`
}

/** One status per menu row: archived, category off, sold out or available. */
export function ItemStatusBadge({ status, context }: { status: ItemStatus; context: ZoneAndLocale }) {
  switch (status.kind) {
    case "archived":
      return <span className={cn(pill, "border-stone-200 bg-stone-100 text-stone-700")}>Archived</span>
    case "category_off":
      return <span className={cn(pill, "border-stone-200 bg-stone-100 text-stone-700")}>Category off</span>
    case "sold_out":
      return (
        <span className={cn(pill, "border-red-200 bg-red-50 text-red-800")}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          Sold out {soldOutUntilText(status.until, context)}
        </span>
      )
    case "available":
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn(pill, "border-emerald-200 bg-emerald-50 text-emerald-800")}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            Available
          </span>
          {status.offFor.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              Not for {status.offFor.map((type) => orderTypeLabels[type].toLowerCase()).join(", ")}
            </span>
          ) : null}
        </span>
      )
  }
}

const dietaryTone: Record<DietaryType, string> = {
  veg: "border-green-700 text-green-700",
  vegan: "border-green-700 text-green-700",
  non_veg: "border-red-700 text-red-700",
  egg: "border-amber-700 text-amber-700",
}

/** The square food-type mark used on Indian menus, with a text label. */
export function DietaryMark({ dietary, showLabel = false }: { dietary: DietaryType; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span aria-hidden className={cn("grid size-3.5 place-items-center rounded-[3px] border-[1.5px]", dietaryTone[dietary])}>
        <span className="size-1.5 rounded-full bg-current" />
      </span>
      <span className={showLabel ? undefined : "sr-only"}>{dietaryLabels[dietary]}</span>
    </span>
  )
}
