"use client"

import { AlertCircle, Moon, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { hoursFieldId, type WindowDraft } from "@/lib/hours/weekly-hours"
import { MAX_WINDOWS_PER_DAY } from "@/lib/time/weekly"
import { isOvernight, validateWindow } from "@/lib/time/windows"

export type FieldErrors = Record<string, string>

export function FieldError({ path, errors }: { path: string; errors: FieldErrors }) {
  const message = errors[path]
  return message ? (
    <p id={`${hoursFieldId(path)}-error`} className="flex items-center gap-1.5 text-sm text-danger-foreground">
      <AlertCircle aria-hidden className="size-3.5 shrink-0" />
      {message}
    </p>
  ) : null
}

/**
 * Opening windows for one day: From/To pickers in 15-minute steps, remove and
 * add. An end before the start runs past midnight and belongs to this day
 * (PRD §3.2); `nextDayLabel` names the day it runs into.
 */
export function TimeWindowsFields({
  windows,
  name,
  nextDayLabel,
  paths,
  errors,
  newKey,
  onChange,
}: {
  windows: WindowDraft[]
  /** Accessible name prefix, e.g. "Delivery Monday". */
  name: string
  nextDayLabel: string
  paths: { window: (key: string) => string; start: (key: string) => string; end: (key: string) => string }
  errors: FieldErrors
  newKey: () => string
  onChange: (windows: WindowDraft[]) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {windows.length ? (
        <ul className="flex flex-col gap-3" aria-label={`${name} opening windows`}>
          {windows.map((window, index) => {
            const label = `${name} window ${index + 1}`
            const startPath = paths.start(window.key)
            const endPath = paths.end(window.key)
            const windowPath = paths.window(window.key)
            const described = (path: string) =>
              [errors[path] ? `${hoursFieldId(path)}-error` : null, errors[windowPath] ? `${hoursFieldId(windowPath)}-error` : null]
                .filter(Boolean)
                .join(" ") || undefined
            const valid = validateWindow(window) === null
            const set = (patch: Partial<WindowDraft>) =>
              onChange(windows.map((candidate) => (candidate.key === window.key ? { ...candidate, ...patch } : candidate)))
            return (
              <li key={window.key} id={hoursFieldId(windowPath)} tabIndex={-1} className="flex flex-col gap-1.5 outline-none">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                    <div className="grid min-w-0 gap-1">
                      <Label htmlFor={hoursFieldId(startPath)} className="text-xs">
                        From<span className="sr-only">, {label}</span>
                      </Label>
                      <Input
                        id={hoursFieldId(startPath)}
                        type="time"
                        step={900}
                        value={window.start}
                        onChange={(event) => set({ start: event.target.value })}
                        aria-invalid={errors[startPath] || errors[windowPath] ? true : undefined}
                        aria-describedby={described(startPath)}
                        className="h-9 w-full px-2 tabular-nums sm:w-32"
                      />
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <Label htmlFor={hoursFieldId(endPath)} className="text-xs">
                        To<span className="sr-only">, {label}</span>
                      </Label>
                      <Input
                        id={hoursFieldId(endPath)}
                        type="time"
                        step={900}
                        value={window.end}
                        onChange={(event) => set({ end: event.target.value })}
                        aria-invalid={errors[endPath] || errors[windowPath] ? true : undefined}
                        aria-describedby={described(endPath)}
                        className="h-9 w-full px-2 tabular-nums sm:w-32"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${label}`}
                    onClick={() => onChange(windows.filter((candidate) => candidate.key !== window.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                {valid && isOvernight(window) ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Moon aria-hidden className="size-3.5" />
                    Runs past midnight into {nextDayLabel}, ending at {window.end}.
                  </p>
                ) : null}
                <FieldError path={startPath} errors={errors} />
                <FieldError path={endPath} errors={errors} />
                <FieldError path={windowPath} errors={errors} />
              </li>
            )
          })}
        </ul>
      ) : null}
      {windows.length < MAX_WINDOWS_PER_DAY ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...windows, { key: newKey(), start: "", end: "" }])}
        >
          <Plus aria-hidden />
          Add window<span className="sr-only"> for {name}</span>
        </Button>
      ) : null}
    </div>
  )
}
