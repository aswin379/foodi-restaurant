import type { ReasonOption } from "@/lib/forms/reasons"

// PROVISIONAL reason lists. Neither list is approved yet, so both live here
// and nowhere else:
// - Reject reasons: PRD Q9 (proposed starting list, not approved).
// - Restaurant cancellation reasons: PRD §4.3 proposal.

export const REJECT_REASONS: readonly ReasonOption[] = [
  { value: "item_unavailable", label: "Item unavailable" },
  { value: "too_busy", label: "Too busy" },
  { value: "closing", label: "Closing soon or closed" },
  { value: "address_issue", label: "Delivery area or address issue" },
  { value: "suspected_fraud", label: "Suspected fraud" },
  { value: "other", label: "Other", requiresNote: true },
]

export const CANCEL_REASONS: readonly ReasonOption[] = [
  { value: "item_unavailable", label: "Item unavailable" },
  { value: "kitchen_issue", label: "Kitchen issue" },
  { value: "closing_early", label: "Closing early" },
  { value: "customer_request", label: "Customer request" },
  { value: "suspected_fraud", label: "Suspected fraud" },
  { value: "other", label: "Other", requiresNote: true },
]

export function reasonLabel(options: readonly ReasonOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}
