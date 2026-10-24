import { cn } from "@/lib/utils"

/**
 * Live-update state for screens such as the order board (PRD §7). Real-time
 * transport is a §9.1 backend contract, so until it exists screens pass
 * "not_configured" (or "preview" for sample data).
 */
export type ConnectionState =
  | "connected"
  | "reconnecting"
  | "polling"
  | "offline"
  | "not_configured"
  | "preview"

const STATES: Record<ConnectionState, { label: string; dot: string }> = {
  connected: { label: "Live", dot: "bg-primary" },
  reconnecting: { label: "Reconnecting…", dot: "bg-amber-500 animate-pulse" },
  polling: { label: "Updating every 15 s", dot: "bg-amber-500" },
  offline: { label: "Offline: updates paused", dot: "bg-destructive" },
  not_configured: { label: "Live updates not connected", dot: "bg-muted-foreground/60" },
  preview: { label: "Preview data: no live updates", dot: "bg-amber-500" },
}

export function ConnectionStatus({
  state,
  className,
}: {
  state: ConnectionState
  className?: string
}) {
  const { label, dot } = STATES[state]
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      {label}
    </p>
  )
}
