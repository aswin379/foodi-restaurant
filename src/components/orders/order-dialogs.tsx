"use client"

import { useId, useState } from "react"
import { Info } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ReasonPicker } from "@/components/shared/reason-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { validateReasonSelection, type ReasonErrors, type ReasonSelection } from "@/lib/forms/reasons"
import {
  DEFAULT_PREP_TIME_MINUTES,
  PREP_ADJUST_MAX,
  PREP_ADJUST_PRESETS,
  PREP_TIME_MAX,
  PREP_TIME_MIN,
  PREP_TIME_PRESETS,
} from "@/lib/orders/commands"
import { formatTime, type ZoneAndLocale } from "@/lib/orders/format"
import { cancellationCheck } from "@/lib/orders/lifecycle"
import { CANCEL_REASONS, REJECT_REASONS } from "@/lib/orders/reasons"
import type { OrderDetail, Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

import type { useOrderCommand } from "./use-order-command"

export type DialogOrder = Pick<
  OrderDetail,
  | "id"
  | "reference"
  | "status"
  | "orderType"
  | "deliveryMode"
  | "paymentMethod"
  | "paymentStatus"
  | "prepTimeMinutes"
  | "readyBy"
  | "rider"
>

type CommandState = ReturnType<typeof useOrderCommand>

type DialogProps = {
  order: DialogOrder
  open: boolean
  onOpenChange: (open: boolean) => void
  command: CommandState
  context: ZoneAndLocale
}

/** Facts the restaurant should know before confirming. */
function Consequences({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function refundConsequence(order: DialogOrder): string | null {
  if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
    return "The online payment is refunded. The refund shows as pending until the payment provider confirms it."
  }
  if (order.paymentMethod === "cash") return "Nothing has been collected for this cash order."
  return null
}

/** Inline failure for errors that aren't about a specific field. */
function GeneralFailure({ command, fields }: { command: CommandState; fields: string[] }) {
  const { result } = command
  if (!result || result.ok) return null
  const coveredByField = fields.some((field) => result.fieldErrors?.[field])
  return coveredByField ? null : <ActionResultMessage result={result} successText="" />
}

/** A minutes picker: preset chips plus a custom value. */
function MinutesPicker({
  legend,
  presets,
  prefix = "",
  value,
  onChange,
  custom,
  onCustomChange,
  min,
  max,
  error,
}: {
  legend: string
  presets: readonly number[]
  prefix?: string
  value: string
  onChange: (value: string) => void
  custom: string
  onCustomChange: (value: string) => void
  min: number
  max: number
  error?: string
}) {
  const id = useId()
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="flex flex-wrap gap-2"
      >
        {[...presets.map(String), "custom"].map((option) => (
          <Label
            key={option}
            htmlFor={`${id}-${option}`}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            )}
          >
            <RadioGroupItem value={option} id={`${id}-${option}`} />
            {option === "custom" ? "Custom" : `${prefix}${option} min`}
          </Label>
        ))}
      </RadioGroup>
      {value === "custom" ? (
        <div className="grid max-w-48 gap-1.5">
          <Label htmlFor={`${id}-custom`}>Minutes</Label>
          <Input
            id={`${id}-custom`}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={custom}
            onChange={(event) => onCustomChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function readMinutes(choice: string, custom: string, min: number, max: number) {
  const minutes = Number(choice === "custom" ? custom : choice)
  return Number.isInteger(minutes) && minutes >= min && minutes <= max ? minutes : null
}

export function AcceptOrderDialog({ order, open, onOpenChange, command }: DialogProps) {
  const [choice, setChoice] = useState(String(DEFAULT_PREP_TIME_MINUTES))
  const [custom, setCustom] = useState("")
  const [error, setError] = useState<string>()
  const serverError = command.fieldErrors.prepTimeMinutes

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Accept order ${order.reference}?`}
      description="Preparation starts when you accept. The customer sees when the order will be ready."
      confirmLabel="Accept order"
      pending={command.pending}
      onConfirm={() => {
        const minutes = readMinutes(choice, custom, PREP_TIME_MIN, PREP_TIME_MAX)
        if (minutes === null) {
          setError(`Enter a prep time between ${PREP_TIME_MIN} and ${PREP_TIME_MAX} minutes.`)
          return
        }
        setError(undefined)
        command.run({ type: "accept", prepTimeMinutes: minutes }, `Order ${order.reference} accepted`, () =>
          onOpenChange(false)
        )
      }}
    >
      <MinutesPicker
        legend="Prep time"
        presets={PREP_TIME_PRESETS}
        value={choice}
        onChange={setChoice}
        custom={custom}
        onCustomChange={setCustom}
        min={PREP_TIME_MIN}
        max={PREP_TIME_MAX}
        error={error ?? serverError}
      />
      <GeneralFailure command={command} fields={["prepTimeMinutes"]} />
    </ConfirmDialog>
  )
}

function useReasonForm(options: typeof REJECT_REASONS, command: CommandState) {
  const [value, setValue] = useState<ReasonSelection>({ reason: null, note: "" })
  const [errors, setErrors] = useState<ReasonErrors>({})
  const shownErrors: ReasonErrors = {
    reason: errors.reason ?? command.fieldErrors.reason,
    note: errors.note ?? command.fieldErrors.note,
  }
  const validate = () => {
    const next = validateReasonSelection(value, options)
    setErrors(next)
    return !next.reason && !next.note
  }
  return { value, setValue, errors: shownErrors, validate }
}

export function RejectOrderDialog({ order, open, onOpenChange, command }: DialogProps) {
  const form = useReasonForm(REJECT_REASONS, command)
  const refund = refundConsequence(order)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reject order ${order.reference}?`}
      description="The customer is told the order was rejected and why."
      confirmLabel="Reject order"
      destructive
      pending={command.pending}
      onConfirm={() => {
        if (!form.validate()) return
        command.run(
          { type: "reject", reason: form.value.reason!, note: form.value.note.trim() },
          `Order ${order.reference} rejected`,
          () => onOpenChange(false)
        )
      }}
    >
      <Consequences items={refund ? [refund] : []} />
      <ReasonPicker
        legend="Why are you rejecting this order?"
        options={REJECT_REASONS}
        value={form.value}
        onChange={form.setValue}
        errors={form.errors}
        noteHint="Shown to Foodi support. Required for Other."
      />
      <GeneralFailure command={command} fields={["reason", "note"]} />
    </ConfirmDialog>
  )
}

export function CancelOrderDialog({ order, open, onOpenChange, command }: DialogProps) {
  const form = useReasonForm(CANCEL_REASONS, command)
  const [riderConfirmed, setRiderConfirmed] = useState(false)
  const [riderError, setRiderError] = useState<string>()
  const check = cancellationCheck(order)
  const needsRider = check.allowed && check.needsRiderConfirmation
  const refund = refundConsequence(order)
  const checkboxId = useId()
  const shownRiderError = riderError ?? command.fieldErrors.riderRecallConfirmed

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel order ${order.reference}?`}
      description="The customer and any rider are told straight away, with your reason."
      confirmLabel="Cancel order"
      cancelLabel="Keep order"
      destructive
      pending={command.pending}
      onConfirm={() => {
        const reasonOk = form.validate()
        const riderOk = !needsRider || riderConfirmed
        setRiderError(riderOk ? undefined : "Confirm that you'll tell the rider to stop.")
        if (!reasonOk || !riderOk) return
        command.run(
          {
            type: "cancel",
            reason: form.value.reason!,
            note: form.value.note.trim(),
            riderRecallConfirmed: riderConfirmed,
          },
          `Order ${order.reference} cancelled`,
          () => onOpenChange(false)
        )
      }}
    >
      <Consequences
        items={[
          "Preparation has already started, so reserved stock isn't returned.",
          ...(refund ? [refund] : []),
          "Restaurant cancellations count towards your cancellation rate.",
        ]}
      />
      <ReasonPicker
        legend="Why are you cancelling this order?"
        options={CANCEL_REASONS}
        value={form.value}
        onChange={form.setValue}
        errors={form.errors}
        noteHint="Shown to Foodi support. Required for Other."
      />
      {needsRider ? (
        <div className="grid gap-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={checkboxId}
              checked={riderConfirmed}
              onCheckedChange={(checked) => setRiderConfirmed(checked === true)}
              aria-invalid={shownRiderError ? true : undefined}
              aria-describedby={shownRiderError ? `${checkboxId}-error` : undefined}
              className="mt-0.5"
            />
            <Label htmlFor={checkboxId} className="leading-snug font-normal">
              {order.rider
                ? `I'll tell ${order.rider.name} to stop the delivery.`
                : "I'll tell the rider to stop the delivery."}
            </Label>
          </div>
          {shownRiderError ? (
            <p id={`${checkboxId}-error`} className="text-sm text-destructive">
              {shownRiderError}
            </p>
          ) : null}
        </div>
      ) : null}
      <GeneralFailure command={command} fields={["reason", "note", "riderRecallConfirmed"]} />
    </ConfirmDialog>
  )
}

export function AdjustPrepTimeDialog({ order, open, onOpenChange, command, context }: DialogProps) {
  const [choice, setChoice] = useState(String(PREP_ADJUST_PRESETS[0]))
  const [custom, setCustom] = useState("")
  const [error, setError] = useState<string>()

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Adjust prep time for ${order.reference}`}
      description={
        order.readyBy
          ? `Currently ${order.prepTimeMinutes} min, ready by ${formatTime(order.readyBy, context)}. The customer's estimate updates.`
          : "The customer's estimate updates."
      }
      confirmLabel="Add time"
      pending={command.pending}
      onConfirm={() => {
        const minutes = readMinutes(choice, custom, 1, PREP_ADJUST_MAX)
        if (minutes === null) {
          setError(`Add between 1 and ${PREP_ADJUST_MAX} minutes.`)
          return
        }
        setError(undefined)
        command.run(
          { type: "adjust_prep_time", addMinutes: minutes },
          `Prep time for ${order.reference} extended by ${minutes} min`,
          () => onOpenChange(false)
        )
      }}
    >
      <MinutesPicker
        legend="Add"
        presets={PREP_ADJUST_PRESETS}
        prefix="+"
        value={choice}
        onChange={setChoice}
        custom={custom}
        onCustomChange={setCustom}
        min={1}
        max={PREP_ADJUST_MAX}
        error={error ?? command.fieldErrors.addMinutes}
      />
      <GeneralFailure command={command} fields={["addMinutes"]} />
    </ConfirmDialog>
  )
}

export function DispatchOrderDialog({
  order,
  open,
  onOpenChange,
  command,
  riders,
}: DialogProps & { riders: Rider[] }) {
  const [riderId, setRiderId] = useState<string>("")
  const [error, setError] = useState<string>()
  const id = useId()
  const shownError = error ?? command.fieldErrors.riderId

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Dispatch order ${order.reference}`}
      description="Choose the rider taking this order. The customer is told it's on the way."
      confirmLabel="Dispatch"
      pending={command.pending}
      onConfirm={() => {
        if (!riderId) {
          setError("Choose a rider.")
          return
        }
        setError(undefined)
        command.run({ type: "dispatch", riderId }, `Order ${order.reference} dispatched`, () =>
          onOpenChange(false)
        )
      }}
    >
      {riders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your riders aren&apos;t connected yet, so this order can&apos;t be dispatched here.
        </p>
      ) : (
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">Rider</legend>
          <RadioGroup
            value={riderId}
            onValueChange={setRiderId}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? `${id}-error` : undefined}
            className="gap-2"
          >
            {riders.map((rider) => (
              <div key={rider.id} className="flex items-center gap-2.5">
                <RadioGroupItem value={rider.id} id={`${id}-${rider.id}`} />
                <Label htmlFor={`${id}-${rider.id}`} className="font-normal">
                  {rider.name}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {shownError ? (
            <p id={`${id}-error`} className="text-sm text-destructive">
              {shownError}
            </p>
          ) : null}
        </fieldset>
      )}
      <GeneralFailure command={command} fields={["riderId"]} />
    </ConfirmDialog>
  )
}
