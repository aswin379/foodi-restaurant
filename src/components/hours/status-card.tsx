import { FlaskConical } from "lucide-react"

import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import { immediateReasonLabels, immediateStateLabels } from "@/lib/hours/labels"
import type { AvailabilityStatus, ImmediateState } from "@/lib/hours/types"
import { formatInstant } from "@/lib/time/format"
import { cn } from "@/lib/utils"

const STATE_STYLES: Record<ImmediateState, string> = {
  open: "border-primary/30 bg-primary/10 text-primary",
  closed: "border-border bg-muted text-muted-foreground",
  paused: "border-amber-300 bg-amber-50 text-amber-950",
  unresolved: "border-dashed border-amber-400 bg-background text-amber-950",
}

/**
 * Whether each order type takes new immediate orders right now, with the
 * reason. Shows only what the server reports (or, in preview, a labelled
 * estimate); nothing is worked out in the browser. Scheduled orders are
 * mentioned only when the server reports them (P-2).
 */
export function StatusCard({ status, locale, className }: { status: AvailabilityStatus; locale: string; className?: string }) {
  const estimate = status.source === "preview_estimate"
  const context = { timeZone: status.timeZone, locale }
  return (
    <section aria-labelledby="hours-status-title" className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hours-status-title" className="text-base font-semibold">
          New orders right now
        </h2>
        <p className="text-xs text-muted-foreground">
          As of {formatInstant(status.asOf, context, "time")} ({status.timeZone})
        </p>
      </div>
      {estimate ? (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0" />
          Preview estimate: not Foodi&apos;s live availability. It ignores menu items and doesn&apos;t cover scheduled orders.
        </p>
      ) : null}
      <ul className="flex flex-col divide-y">
        {ORDER_TYPES.map((type) => {
          const { immediate, scheduled } = status.byOrderType[type]
          return (
            <li key={type} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{orderTypeLabels[type]}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", STATE_STYLES[immediate.state])}>
                  {immediateStateLabels[immediate.state]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {immediateStateLabels[immediate.state]}: {immediateReasonLabels[immediate.reason]}
                {immediate.until ? `, until ${formatInstant(immediate.until, context)}` : ""}
                {immediate.nextOpening ? `. Next opening ${formatInstant(immediate.nextOpening, context)}` : ""}.
              </p>
              {scheduled ? (
                <p className="text-xs text-muted-foreground">
                  Scheduled orders:{" "}
                  {scheduled.accepting ? "accepted, each checked by Foodi for its time" : "not accepted right now"}.
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
