import { formatDateTime } from "@/lib/orders/format"
import { orderStatusLabels } from "@/lib/orders/lifecycle"
import type { OrderTimelineEvent } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const actorLabels: Record<OrderTimelineEvent["actor"], string> = {
  customer: "Customer",
  restaurant: "Restaurant",
  foodi: "Foodi",
  system: "Automatic",
}

export function OrderTimeline({ events }: { events: OrderTimelineEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const last = index === events.length - 1
        const closed = event.status === "rejected" || event.status === "cancelled"
        return (
          <li key={`${event.status}-${event.at}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span aria-hidden className="absolute top-4 left-[7px] h-full w-px bg-border" />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 size-[15px] shrink-0 rounded-full border-2 bg-background",
                closed ? "border-red-500" : last ? "border-primary bg-primary" : "border-primary"
              )}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {orderStatusLabels[event.status]}
                {last ? <span className="sr-only"> (current status)</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={event.at}>{formatDateTime(event.at)}</time> ·{" "}
                {actorLabels[event.actor]}
              </p>
              {event.reason ? (
                <p className="mt-1 text-xs text-foreground/80">Reason: {event.reason}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
