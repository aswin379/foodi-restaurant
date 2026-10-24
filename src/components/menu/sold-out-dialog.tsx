"use client"

import { useId, useState } from "react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { HIDDEN_FROM_CUSTOMERS_NOTE } from "@/lib/menu/labels"
import { SOLD_OUT_REASON_MAX, type SoldOutChoice } from "@/lib/menu/validation"

import type { useMenuCommand } from "./use-menu-command"

export const soldOutChoiceLabels: Record<SoldOutChoice, string> = {
  next_opening: "Until next opening",
  end_of_day: "Until end of day",
  for_1h: "For 1 hour",
  for_2h: "For 2 hours",
  for_4h: "For 4 hours",
  manual: "Until I switch it back on",
}

/** Picks how long an item stays sold out (PRD §3.4 sold-out shortcut). */
export function SoldOutChoices({
  value,
  onChange,
  reason,
  onReasonChange,
  reasonError,
  idPrefix,
  extraChoice,
}: {
  value: string
  onChange: (value: string) => void
  reason: string
  onReasonChange: (value: string) => void
  reasonError?: string
  idPrefix: string
  /** E.g. keep the current sold-out time when editing. */
  extraChoice?: { value: string; label: string }
}) {
  const choices = [
    ...(extraChoice ? [extraChoice] : []),
    ...Object.entries(soldOutChoiceLabels).map(([choice, label]) => ({ value: choice, label })),
  ]
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Sold out</legend>
        <RadioGroup value={value} onValueChange={onChange} className="gap-2">
          {choices.map((choice) => (
            <div key={choice.value} className="flex items-center gap-2.5">
              <RadioGroupItem value={choice.value} id={`${idPrefix}-${choice.value}`} />
              <Label htmlFor={`${idPrefix}-${choice.value}`} className="font-normal">
                {choice.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-reason`}>
          Reason <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}-reason`}
          value={reason}
          maxLength={SOLD_OUT_REASON_MAX}
          onChange={(event) => onReasonChange(event.target.value)}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? `${idPrefix}-reason-error` : undefined}
        />
        {reasonError ? (
          <p id={`${idPrefix}-reason-error`} className="text-sm text-destructive">
            {reasonError}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function SoldOutDialog({
  itemId,
  itemName,
  open,
  onOpenChange,
  command,
}: {
  itemId: string
  itemName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  command: ReturnType<typeof useMenuCommand>
}) {
  const id = useId()
  const [until, setUntil] = useState<SoldOutChoice>("next_opening")
  const [reason, setReason] = useState("")
  const { result } = command

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${itemName} sold out?`}
      description={`Orders can't include it until it's available again. ${HIDDEN_FROM_CUSTOMERS_NOTE} Orders already placed aren't changed.`}
      confirmLabel="Mark sold out"
      pending={command.pending}
      onConfirm={() =>
        command.run({ type: "set_sold_out", itemId, until, reason }, `${itemName} marked sold out`, () =>
          onOpenChange(false)
        )
      }
    >
      <SoldOutChoices
        idPrefix={id}
        value={until}
        onChange={(value) => setUntil(value as SoldOutChoice)}
        reason={reason}
        onReasonChange={setReason}
        reasonError={command.fieldErrors.reason}
      />
      {result && !result.ok && !result.fieldErrors?.reason ? <ActionResultMessage result={result} successText="" /> : null}
    </ConfirmDialog>
  )
}
