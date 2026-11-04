"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useVisibleRefresh } from "@/hooks/use-visible-refresh"
import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import { immediateReasonLabels, immediateStateLabels } from "@/lib/hours/labels"
import type { AvailabilityStatus, ImmediateState } from "@/lib/hours/types"
import { formatInstant } from "@/lib/time/format"
import { cn } from "@/lib/utils"

// The design system's status tones: open is success (green), never the brand orange.
const STATE_STYLES: Record<ImmediateState, string> = {
  open: "border-success-line bg-success-soft text-success-foreground",
  closed: "border-danger-line bg-danger-soft text-danger-foreground",
  paused: "border-warning-line bg-warning-soft text-warning-foreground",
  unresolved: "border-dashed border-warning-line bg-card text-warning-foreground",
}

/**
 * Whether each order type takes new immediate orders right now, with the
 * reason. Shows live server availability, auto-refreshing periodically.
 */
export function StatusCard({
  status,
  locale,
  types = ORDER_TYPES,
  className,
}: {
  status: AvailabilityStatus
  locale: string
  /** Only these order types are listed (the ones the restaurant has switched on). */
  types?: readonly OrderType[]
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Auto-refresh availability live while tab is active
  useVisibleRefresh(true, 15_000)

  const estimate = status.source === "preview_estimate"
  const context = { timeZone: status.timeZone, locale }

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <section
      aria-labelledby="hours-status-title"
      className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-6", className)}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 id="hours-status-title" className="text-lg leading-7 font-semibold">
              New orders right now
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            As of {formatInstant(status.asOf, context, "time")} ({status.timeZone})
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isPending}
          title="Refresh live status"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <RotateCw className={cn("size-3.5", isPending && "animate-spin")} />
          <span className="sr-only">Refresh live status</span>
        </Button>
      </div>
      {estimate ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
          <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0" />
          Preview estimate: not Foodi&apos;s live availability. It ignores menu items and doesn&apos;t cover scheduled orders.
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {types.map((type) => {
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
