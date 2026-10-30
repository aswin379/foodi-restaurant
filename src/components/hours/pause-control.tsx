"use client"

import { useId, useState } from "react"
import { Loader2, PauseCircle } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { PAUSE_REASON_MAX } from "@/lib/hours/commands"
import { actorLabel, PAUSE_EFFECT_NOTE, pauseDurationLabels, resumeText } from "@/lib/hours/labels"
import { PAUSE_DURATIONS, type PauseDuration, type PauseState } from "@/lib/hours/types"
import { formatInstant } from "@/lib/time/format"

import { PauseBanner } from "./pause-banner"
import { useHoursCommand } from "./use-hours-command"

/**
 * Pause new orders (H5): restaurant-wide, one of the five PRD durations. The
 * server works out when the pause ends; this control only shows it.
 */
export function PauseControl({ pause, timeZone, locale }: { pause: PauseState; timeZone: string; locale: string }) {
  if (pause.paused) return <PauseBanner pause={pause} locale={locale} />

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium">Taking new orders</p>
        <p className="text-xs text-muted-foreground">
          {pause.lastResumedAt
            ? `Last resumed ${formatInstant(pause.lastResumedAt, { timeZone, locale })} by ${actorLabel(pause.lastResumedBy)}.`
            : "Pause new orders when the kitchen needs a break."}
        </p>
      </div>
      <PauseDialog timeZone={timeZone} locale={locale} />
    </div>
  )
}

function PauseDialog({ timeZone, locale }: { timeZone: string; locale: string }) {
  const id = useId()
  const command = useHoursCommand()
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState<PauseDuration>("30m")
  const [reason, setReason] = useState("")
  const reasonError = command.fieldErrors.reason
  const failure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (command.pending) return
        if (next) {
          setDuration("30m")
          setReason("")
          command.begin()
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="sm:shrink-0">
          <PauseCircle aria-hidden />
          Pause new orders
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            command.run(
              { type: "pause", duration, reason: reason.trim() },
              (result) => (result.kind === "pause" && result.pause.paused ? `Restaurant paused ${resumeText(result.pause, locale)}` : "Restaurant paused"),
              () => setOpen(false)
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>Pause new orders?</DialogTitle>
            <DialogDescription>{PAUSE_EFFECT_NOTE}</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">How long</legend>
            <RadioGroup value={duration} onValueChange={(value) => setDuration(value as PauseDuration)} className="gap-2">
              {PAUSE_DURATIONS.map((option) => (
                <div key={option} className="flex items-center gap-2.5">
                  <RadioGroupItem value={option} id={`${id}-${option}`} />
                  <Label htmlFor={`${id}-${option}`} className="font-normal">
                    {pauseDurationLabels[option]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {duration === "rest_of_today"
                ? `Until midnight in ${timeZone}. Foodi works out the exact time, including clock changes, and shows it once paused.`
                : duration === "until_resumed"
                  ? "New orders stay paused until someone resumes them."
                  : "New orders resume automatically. Foodi shows the exact time once paused."}
            </p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-reason`} className="gap-2">
              Reason
              <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? `${id}-reason-error` : undefined}
              maxLength={PAUSE_REASON_MAX + 50}
            />
            {reasonError ? (
              <p id={`${id}-reason-error`} className="text-sm text-destructive">
                {reasonError}
              </p>
            ) : null}
          </div>

          {failure ? <ActionResultMessage result={failure} successText="" /> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={command.pending || undefined}>
              {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Pause new orders
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
