import { reviewModerationLabels, type Review } from "@/lib/reviews/types"
import { cn } from "@/lib/utils"

const pill =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

/** Whether the restaurant has replied. Always known: it's whether a reply exists. */
export function ReplyStatusBadge({ review }: { review: Pick<Review, "reply"> }) {
  return review.reply ? (
    <span className={cn(pill, "border-emerald-200 bg-emerald-50 text-emerald-800")}>Replied</span>
  ) : (
    <span className={cn(pill, "border-amber-200 bg-amber-50 text-amber-800")}>Not replied</span>
  )
}

/** R7: the source's own moderation status, only when it supplied one. */
export function ModerationBadge({ review }: { review: Pick<Review, "moderation"> }) {
  if (!review.moderation) return null
  return (
    <span className={cn(pill, "border-stone-200 bg-stone-100 text-stone-700")}>
      {reviewModerationLabels[review.moderation]}
    </span>
  )
}

/** This restaurant's report, when one exists. It says a report was made, not what happened to it (R8). */
export function ReportedBadge({ review }: { review: Pick<Review, "report"> }) {
  if (!review.report) return null
  return <span className={cn(pill, "border-stone-200 bg-stone-100 text-stone-700")}>You reported this</span>
}
