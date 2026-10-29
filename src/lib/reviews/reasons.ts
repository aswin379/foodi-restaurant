import type { ReasonOption } from "@/lib/forms/reasons"

// PROPOSED report-abuse reasons. No taxonomy exists in the PRD or the shared
// code (the shared reason lists are for rejecting and cancelling orders), and
// the backend hasn't defined one, so this starting list lives here and
// nowhere else. It is not a finalised contract (docs/reviews-ui.md).

export const REVIEW_REPORT_REASONS: readonly ReasonOption[] = [
  { value: "spam_or_fake", label: "Spam or a fake review" },
  { value: "abusive_language", label: "Offensive or abusive language" },
  { value: "personal_information", label: "Contains personal information" },
  { value: "not_about_restaurant", label: "Not about this restaurant" },
  { value: "other", label: "Other", requiresNote: true },
]

/** An unknown value from the source is shown as sent, never swapped for a guess. */
export function reportReasonLabel(value: string) {
  return REVIEW_REPORT_REASONS.find((option) => option.value === value)?.label ?? value
}
