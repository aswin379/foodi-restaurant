import Link from "next/link"
import { FlaskConical, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import { immediateReasonLabels, immediateStateLabels } from "@/lib/hours/labels"
import type { AvailabilityStatus, ImmediateState } from "@/lib/hours/types"
import { formatInstant } from "@/lib/time/format"
import { cn } from "@/lib/utils"

const STATE_STYLES: Record<ImmediateState, string> = {
  open: "border-success-line bg-success-soft text-success-foreground",
  closed: "border-neutral-line bg-neutral-soft text-neutral-foreground",
  paused: "border-warning-line bg-warning-soft text-warning-foreground",
  unresolved: "border-dashed border-warning-line bg-card text-warning-foreground",
}

/**
 * The dashboard's compact version of the Hours status card: the same server
 * data and the same wording (whether each order type takes new immediate
 * orders right now, and why), laid out as one tile per order type. Nothing is
 * worked out here, and a preview estimate is labelled as one. The Hours page
 * keeps its own StatusCard.
 */
export function OpeningStatus({ status, locale }: { status: AvailabilityStatus; locale: string }) {
  const estimate = status.source === "preview_estimate"
  const context = { timeZone: status.timeZone, locale }
  return (
    <section aria-labelledby="hours-status-title" className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 id="hours-status-title" className="text-lg leading-7 font-semibold">
            New orders right now
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            As of {formatInstant(status.asOf, context, "time")} ({status.timeZone})
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/hours">
            <Settings2 aria-hidden />
            Manage hours and pause
          </Link>
        </Button>
      </div>
      {estimate ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
          <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0" />
          Preview estimate: not Foodi&apos;s live availability. It ignores menu items and doesn&apos;t cover scheduled orders.
        </p>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-3">
        {ORDER_TYPES.map((type) => {
          const { immediate, scheduled } = status.byOrderType[type]
          return (
            <li key={type} className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{orderTypeLabels[type]}</span>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATE_STYLES[immediate.state])}>
                  {immediateStateLabels[immediate.state]}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {immediateStateLabels[immediate.state]}: {immediateReasonLabels[immediate.reason]}
                {immediate.until ? `, until ${formatInstant(immediate.until, context)}` : ""}
                {immediate.nextOpening ? `. Next opening ${formatInstant(immediate.nextOpening, context)}` : ""}.
              </p>
              {scheduled ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
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
