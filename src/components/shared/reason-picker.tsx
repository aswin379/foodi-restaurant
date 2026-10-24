"use client"

import { useId } from "react"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  REASON_NOTE_MAX_LENGTH,
  type ReasonErrors,
  type ReasonOption,
  type ReasonSelection,
} from "@/lib/forms/reasons"
import { cn } from "@/lib/utils"

/**
 * A required reason from a module-supplied list, plus a note. Errors come
 * from validateReasonSelection so the client and server use the same rules.
 */
export function ReasonPicker({
  legend,
  options,
  value,
  onChange,
  errors,
  noteLabel = "Note",
  noteHint,
  name = "reason",
  className,
}: {
  legend: string
  options: readonly ReasonOption[]
  value: ReasonSelection
  onChange: (value: ReasonSelection) => void
  errors?: ReasonErrors
  noteLabel?: string
  noteHint?: string
  /** Form field names: `${name}` and `${name}Note`. */
  name?: string
  className?: string
}) {
  const id = useId()
  const reasonErrorId = `${id}-reason-error`
  const noteErrorId = `${id}-note-error`
  const noteHintId = `${id}-note-hint`
  const selected = options.find((option) => option.value === value.reason)
  const noteRequired = Boolean(selected?.requiresNote)

  return (
    <fieldset className={cn("grid gap-4", className)}>
      <legend className="mb-3 text-sm font-medium">
        {legend} <span className="text-destructive" aria-hidden>*</span>
        <span className="sr-only"> (required)</span>
      </legend>

      <RadioGroup
        name={name}
        value={value.reason ?? ""}
        onValueChange={(reason) => onChange({ ...value, reason })}
        aria-invalid={errors?.reason ? true : undefined}
        aria-describedby={errors?.reason ? reasonErrorId : undefined}
        className="gap-2"
      >
        {options.map((option) => {
          const optionId = `${id}-${option.value}`
          return (
            <div key={option.value} className="flex items-center gap-2.5">
              <RadioGroupItem value={option.value} id={optionId} />
              <Label htmlFor={optionId} className="font-normal">
                {option.label}
              </Label>
            </div>
          )
        })}
      </RadioGroup>
      {errors?.reason ? (
        <p id={reasonErrorId} className="text-sm text-destructive">
          {errors.reason}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-note`}>
          {noteLabel}
          {noteRequired ? (
            <>
              {" "}
              <span className="text-destructive" aria-hidden>*</span>
              <span className="sr-only"> (required)</span>
            </>
          ) : (
            <span className="font-normal text-muted-foreground"> (optional)</span>
          )}
        </Label>
        <Textarea
          id={`${id}-note`}
          name={`${name}Note`}
          value={value.note}
          maxLength={REASON_NOTE_MAX_LENGTH}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          aria-invalid={errors?.note ? true : undefined}
          aria-describedby={
            [noteHint ? noteHintId : null, errors?.note ? noteErrorId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          rows={3}
        />
        {noteHint ? (
          <p id={noteHintId} className="text-xs text-muted-foreground">
            {noteHint}
          </p>
        ) : null}
        {errors?.note ? (
          <p id={noteErrorId} className="text-sm text-destructive">
            {errors.note}
          </p>
        ) : null}
      </div>
    </fieldset>
  )
}
