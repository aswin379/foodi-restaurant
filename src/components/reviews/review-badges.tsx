import { reviewModerationLabels, type Review } from "@/lib/reviews/types"
import { cn } from "@/lib/utils"

const pill =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

/** Whether the restaurant has replied. Always known: it's whether a reply exists. */
export function ReplyStatusBadge({ review }: { review: Pick<Review, "reply"> }) {
  return review.reply ? (
    <span className={cn(pill, "border-success-line bg-success-soft text-success-foreground")}>Replied</span>
  ) : (
    <span className={cn(pill, "border-warning-line bg-warning-soft text-warning-foreground")}>Not replied</span>
  )
}

/** R7: the source's own moderation status, only when it supplied one. */
export function ModerationBadge({ review }: { review: Pick<Review, "moderation"> }) {
  if (!review.moderation) return null
  return (
    <span className={cn(pill, "border-neutral-line bg-neutral-soft text-neutral-foreground")}>
      {reviewModerationLabels[review.moderation]}
    </span>
  )
}

/** This restaurant's report, when one exists. It says a report was made, not what happened to it (R8). */
export function ReportedBadge({ review }: { review: Pick<Review, "report"> }) {
  if (!review.report) return null
  return <span className={cn(pill, "border-neutral-line bg-neutral-soft text-neutral-foreground")}>You reported this</span>
}
