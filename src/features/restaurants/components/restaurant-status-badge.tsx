import { Badge } from "@/components/ui/badge"

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  APPROVED: { label: "Approved", variant: "success" },
  SUBMITTED: { label: "Submitted · awaiting review", variant: "info" },
  UNDER_REVIEW: { label: "Under review", variant: "info" },
  CHANGES_REQUESTED: { label: "Changes requested", variant: "warning" },
  REJECTED: { label: "Rejected", variant: "danger" },
  SUSPENDED: { label: "Suspended", variant: "danger" },
  DRAFT: { label: "Draft", variant: "neutral" },
}

export function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status
}

export function RestaurantStatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, variant: "neutral" as const }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}
