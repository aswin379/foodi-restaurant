import { formatDateTime, type ZoneAndLocale } from "@/lib/orders/format"
import { orderEventLabels } from "@/lib/orders/lifecycle"
import type { OrderActor, OrderTimelineEvent } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const actorLabels: Record<OrderActor, string> = {
  customer: "Customer",
  restaurant: "Restaurant",
  foodi: "Foodi",
  system: "Automatic",
}

/** Who did what, when and why (PRD §4.3 audit trail, as shown to the restaurant). */
export function OrderTimeline({
  events,
  context,
}: {
  events: OrderTimelineEvent[]
  context: ZoneAndLocale
}) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const last = index === events.length - 1
        const closed = event.type === "rejected" || event.type === "cancelled"
        return (
          <li key={`${event.type}-${event.at}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span aria-hidden className="absolute top-4 left-[7px] h-full w-px bg-border" />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 size-[15px] shrink-0 rounded-full border-2 bg-card",
                closed ? "border-danger" : last ? "border-primary bg-primary" : "border-primary"
              )}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {orderEventLabels[event.type]}
                {last ? <span className="sr-only"> (latest)</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={event.at}>{formatDateTime(event.at, context)}</time> ·{" "}
                {actorLabels[event.actor]}
                {event.detail ? ` · ${event.detail}` : null}
              </p>
              {event.reason ? (
                <p className="mt-1 text-xs text-foreground/80">Reason: {event.reason}</p>
              ) : null}
              {event.note ? (
                <p className="mt-0.5 text-xs text-foreground/80">Note: {event.note}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
