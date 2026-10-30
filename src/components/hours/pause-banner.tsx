"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PauseCircle, PlayCircle } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { actorLabel, PAUSE_EFFECT_NOTE, resumeText } from "@/lib/hours/labels"
import type { PauseState } from "@/lib/hours/types"

import { useHoursCommand } from "./use-hours-command"

/**
 * Shown while the restaurant is paused (PRD §3.5 dashboard banner). The
 * resume time is the server's; when it passes, the page re-asks the server
 * rather than assuming the pause ended.
 */
export function PauseBanner({ pause, locale }: { pause: Extract<PauseState, { paused: true }>; locale: string }) {
  const router = useRouter()
  const command = useHoursCommand()

  useEffect(() => {
    if (!pause.until) return
    const wait = new Date(pause.until).getTime() - Date.now() + 1500
    // Only schedule a re-check for pauses ending within a day; setTimeout can't wait longer reliably.
    if (wait > 86_400_000) return
    const timer = setTimeout(() => router.refresh(), Math.max(wait, 1000))
    return () => clearTimeout(timer)
  }, [pause.until, router])

  const failure = command.result && !command.result.ok ? command.result : null

  return (
    <section
      aria-labelledby="pause-banner-title"
      className="flex flex-col gap-3 rounded-3xl border border-warning-line bg-warning-soft px-5 py-4 text-warning-foreground shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-warning-foreground"><PauseCircle className="size-5" strokeWidth={1.75} /></span>
        <div className="flex flex-col gap-1">
          <h2 id="pause-banner-title" className="text-base font-semibold">
            Restaurant paused {resumeText(pause, locale)}
          </h2>
          <p className="text-xs leading-relaxed">
            {PAUSE_EFFECT_NOTE} Paused by {actorLabel(pause.by)}
            {pause.reason ? `: ${pause.reason}` : "."}
          </p>
          {failure ? <ActionResultMessage result={failure} successText="" /> : null}
        </div>
      </div>
      <Button
        type="button"
        className="sm:shrink-0"
        aria-disabled={command.pending || undefined}
        onClick={() => {
          if (!command.pending) command.run({ type: "resume" }, "Restaurant resumed: new orders are open again")
        }}
      >
        {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : <PlayCircle aria-hidden />}
        Resume now
      </Button>
    </section>
  )
}
