"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, Loader2, PauseCircle, PlayCircle } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useHoursCommand } from "@/hooks/use-hours-command"
import type { OrderType } from "@/lib/domain/order-types"
import { PAUSE_REASON_MAX } from "@/lib/hours/commands"
import { actorLabel, PAUSE_TAB_NOTE, pauseDurationLabels, resumeText } from "@/lib/hours/labels"
import { PAUSE_DURATIONS, type PauseDuration, type PauseState } from "@/lib/hours/types"

const shortLabels: Record<PauseDuration, string> = {
  ...pauseDurationLabels,
  rest_of_today: "Rest of today",
}

/**
 * New orders right now, for one tab. The status is the server's; choosing a duration pauses only this
 * order type (delivery covers both delivery modes), and Resume ends it early. The server works out
 * when a pause ends and resumes it by itself.
 */
export function PauseControl({
  type,
  pause,
  locale,
  canPause,
}: {
  type: OrderType
  pause: PauseState
  locale: string
  canPause: boolean
}) {
  const id = useId()
  const router = useRouter()
  const command = useHoursCommand()
  const [reason, setReason] = useState("")
  const until = pause.paused ? pause.until : null

  // When the pause is due to end, ask the server again rather than assuming it did.
  useEffect(() => {
    if (!until) return
    const wait = new Date(until).getTime() - Date.now() + 1500
    if (wait > 86_400_000) return
    const timer = setTimeout(() => router.refresh(), Math.max(wait, 1000))
    return () => clearTimeout(timer)
  }, [until, router])

  const failure = command.result && !command.result.ok ? command.result : null
  const reasonError = command.fieldErrors.reason

  return (
    <section aria-label="New orders right now" className="flex flex-col gap-3 rounded-2xl bg-background/70 p-4 ring-1 ring-border-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={
              pause.paused
                ? "grid size-9 shrink-0 place-items-center rounded-full bg-warning-soft text-warning-foreground"
                : "grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success-foreground"
            }
          >
            {pause.paused ? <PauseCircle className="size-5" strokeWidth={1.75} /> : <CircleCheck className="size-5" strokeWidth={1.75} />}
          </span>
          <div className="flex flex-col">
            <p className="text-base font-semibold">{pause.paused ? `Paused ${resumeText(pause, locale)}` : "Accepting orders"}</p>
            {pause.paused ? (
              <p className="text-xs text-muted-foreground">
                Paused by {actorLabel(pause.by)}
                {pause.reason ? `: ${pause.reason}` : "."}
              </p>
            ) : null}
          </div>
        </div>
        {pause.paused && canPause ? (
          <Button
            type="button"
            aria-disabled={command.pending || undefined}
            onClick={() => {
              if (command.pending) return
              command.begin()
              command.run({ type: "resume", scope: type }, "New orders are open again")
            }}
          >
            {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : <PlayCircle aria-hidden />}
            Resume
          </Button>
        ) : null}
      </div>

      {!pause.paused && canPause ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-reason`} className="gap-2 text-xs">
              Reason<span className="font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input
              id={`${id}-reason`}
              value={reason}
              maxLength={PAUSE_REASON_MAX + 50}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonError ? true : undefined}
              className="max-w-md"
            />
            {reasonError ? <p className="text-sm text-danger-foreground">{reasonError}</p> : null}
          </div>
          <div role="group" aria-label="Pause new orders for" className="flex flex-wrap gap-2">
            {PAUSE_DURATIONS.map((duration) => (
              <Button
                key={duration}
                type="button"
                variant="outline"
                size="sm"
                aria-disabled={command.pending || undefined}
                onClick={() => {
                  if (command.pending) return
                  command.begin()
                  command.run({ type: "pause", duration, reason: reason.trim(), scope: type }, "New orders paused", () => setReason(""))
                }}
              >
                {shortLabels[duration]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{PAUSE_TAB_NOTE}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{PAUSE_TAB_NOTE}</p>
      )}

      {failure ? <ActionResultMessage result={failure} successText="" /> : null}
    </section>
  )
}
