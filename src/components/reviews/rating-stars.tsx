import { Star } from "lucide-react"

import { REVIEW_RATINGS, ratingText, type ReviewRating } from "@/lib/reviews/types"
import { cn } from "@/lib/utils"

/** Five stars with the rating spoken as one phrase ("4 out of 5 stars"); the icons are decoration. */
export function RatingStars({ rating, className }: { rating: ReviewRating; className?: string }) {
  return (
    <span role="img" aria-label={ratingText(rating)} className={cn("inline-flex items-center gap-0.5", className)}>
      {REVIEW_RATINGS.map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn("size-4", star <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  )
}
