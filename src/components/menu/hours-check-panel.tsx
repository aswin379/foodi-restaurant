import { AlertTriangle, CheckCircle2, Info } from "lucide-react"

import { checkAgainstHours, type HoursCheck, type HoursForCheck } from "@/lib/menu/hours-warnings"
import type { MealPeriod } from "@/lib/menu/meal-periods"
import { scheduleFromDraft, validateScheduleDraft } from "@/lib/menu/schedule"
import type { MenuCategory } from "@/lib/menu/types"
import type { MenuItemDraft } from "@/lib/menu/validation"
import { cn } from "@/lib/utils"

export const HOURS_CHECK_LIMITS =
  "Advisory only; it never stops you saving. It compares weekly clock times only: special dates, pauses, sold out, a switched-off category and daylight-saving changes aren't included. Foodi decides actual availability."

type Outcome = { kind: "pending"; message: string } | HoursCheck

function outcomeFor({
  draft,
  categories,
  mealPeriods,
  hours,
  timeZone,
}: {
  draft: MenuItemDraft
  categories: MenuCategory[] | null
  mealPeriods: MealPeriod[] | null
  hours: HoursForCheck
  timeZone: string
}): Outcome {
  if (!draft.categoryId) return { kind: "pending", message: "Choose a category to check this item against restaurant hours." }
  if (Object.keys(validateScheduleDraft(draft.schedule, draft.channels)).length > 0) {
    return { kind: "pending", message: "Fix the schedule to check it against restaurant hours." }
  }
  if (!categories) return { kind: "unresolved", reasons: ["Categories couldn't be loaded."] }
  const category = categories.find((candidate) => candidate.id === draft.categoryId) ?? null
  return checkAgainstHours({
    timeZone,
    hours: hours.kind === "loaded" ? hours : null,
    hoursProblem: hours.kind === "unavailable" ? hours.reason : undefined,
    // Evaluated as it would be saved: in the restaurant's zone.
    item: { channels: draft.channels, schedule: scheduleFromDraft(draft.schedule, timeZone) },
    category,
    mealPeriods,
  })
}

/**
 * B3b, H10: compares the item's effective weekly schedule (with its
 * category's) against restaurant hours. Advisory only, never blocks saving,
 * and never presented as actual availability. When something can't be
 * worked out, it says "Unable to evaluate schedule" instead of guessing.
 */
export function HoursCheckPanel(props: {
  draft: MenuItemDraft
  categories: MenuCategory[] | null
  mealPeriods: MealPeriod[] | null
  hours: HoursForCheck
  timeZone: string
}) {
  const outcome = outcomeFor(props)
  return (
    <section aria-labelledby="item-hours-check-title" className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <h3 id="item-hours-check-title" className="text-sm font-medium">
        Check against restaurant hours
      </h3>
      <Result outcome={outcome} />
      <p className="text-xs text-muted-foreground">{HOURS_CHECK_LIMITS}</p>
    </section>
  )
}

function Result({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "pending") {
    return (
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {outcome.message}
      </p>
    )
  }
  if (outcome.kind === "unresolved") {
    return (
      <div className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <AlertTriangle aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          Unable to evaluate schedule
        </p>
        <ul className="list-disc pl-6 text-xs text-muted-foreground">
          {outcome.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (outcome.findings.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm">
        <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-700" />
        No conflicts with weekly restaurant hours.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Hours warnings">
      {outcome.findings.map((finding) => (
        <li
          key={finding.message}
          className={cn(
            "flex flex-col gap-1 rounded-md border px-3 py-2 text-sm",
            finding.severity === "strong"
              ? "border-red-300 bg-red-50 text-red-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          )}
        >
          <p className="flex items-start gap-1.5">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="sr-only">{finding.severity === "strong" ? "Strong warning: " : "Warning: "}</span>
              {finding.message}
            </span>
          </p>
          {finding.times.length ? (
            <ul className="pl-6 text-xs">
              {finding.times.map((time) => (
                <li key={time}>{time}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
