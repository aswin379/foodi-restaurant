"use client"

import { useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import type { MealPeriod } from "@/lib/menu/meal-periods"
import { scheduleDraftFrom } from "@/lib/menu/schedule"
import type { MenuCategory } from "@/lib/menu/types"
import {
  CATEGORY_NAME_MAX,
  fieldId,
  hasErrors,
  validateCategoryDraft,
  type CategoryDraft,
  type FieldErrors,
} from "@/lib/menu/validation"

import { ScheduleEditor } from "./schedule-editor"
import { useMenuCommand } from "./use-menu-command"

/** What the category schedule needs (B3b); null when the restaurant's zone couldn't be loaded. */
export type CategoryScheduleSupport = { timeZone: string; mealPeriods: MealPeriod[] | null } | null

/** Keys for new rows; the server mints real ids. Only [\w-] so they survive parsing. */
const newKey = () => `new-${crypto.randomUUID().slice(0, 8)}`

function draftFrom(category: MenuCategory | undefined, withSchedule: boolean): CategoryDraft {
  return {
    name: category?.name ?? "",
    description: category?.description ?? "",
    active: category?.active ?? true,
    channels: category?.channels ?? { delivery: true, takeaway: true, dine_in: true },
    // Without schedule support the schedule is left out, which keeps the saved one.
    ...(withSchedule ? { schedule: category ? scheduleDraftFrom(category.schedule) : { mode: "always" as const } } : {}),
  }
}

/**
 * Add or edit a category (PRD §3.4: on/off, order types and, since B3b, a
 * schedule). Validated here and again on the server; in preview mode the
 * save is simulated.
 */
export function CategoryDialog({
  category,
  trigger,
  scheduleSupport = null,
}: {
  category?: MenuCategory
  trigger: React.ReactNode
  scheduleSupport?: CategoryScheduleSupport
}) {
  const id = useId()
  const command = useMenuCommand()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CategoryDraft>(() => draftFrom(category, scheduleSupport !== null))
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const errors: FieldErrors = { ...command.fieldErrors, ...localErrors }

  function onOpenChange(next: boolean) {
    if (command.pending) return
    if (next) {
      // Start from the saved values each time; nothing carries over.
      setDraft(draftFrom(category, scheduleSupport !== null))
      setLocalErrors({})
      command.begin()
    }
    setOpen(next)
  }

  function update(patch: Partial<CategoryDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (hasErrors(localErrors)) setLocalErrors(validateCategoryDraft(next))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateCategoryDraft(draft)
    setLocalErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      const scheduleError = Object.keys(nextErrors).find((key) => key.startsWith("schedule"))
      document
        .getElementById(
          nextErrors.name
            ? `${id}-name`
            : nextErrors.description
              ? `${id}-description`
              : nextErrors.channels || !scheduleError
                ? `${id}-channels`
                : fieldId(scheduleError)
        )
        ?.focus()
      return
    }
    const name = draft.name.trim()
    command.run(
      { type: "save_category", categoryId: category?.id ?? null, draft },
      category ? `${name} updated` : `${name} added`,
      () => setOpen(false)
    )
  }

  const editing = Boolean(category)
  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
        <AlertCircle aria-hidden className="size-3.5" />
        {errors[key]}
      </p>
    ) : null
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${category?.name}` : "Add category"}</DialogTitle>
            <DialogDescription>Categories group items on your menu, like Starters or Drinks.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-name`} className="gap-2">
              Category name
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Required</span>
            </Label>
            <Input
              id={`${id}-name`}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              maxLength={CATEGORY_NAME_MAX + 20}
              autoComplete="off"
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
              className="h-10"
            />
            {fieldError("name")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-description`} className="gap-2">
              Description
              <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Textarea
              id={`${id}-description`}
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              rows={2}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? `${id}-description-error` : undefined}
            />
            {fieldError("description")}
          </div>

          <div className="flex items-start gap-3">
            <Switch
              id={`${id}-active`}
              checked={draft.active}
              onCheckedChange={(active) => update({ active })}
              aria-describedby={`${id}-active-help`}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-active`}>Category on</Label>
              <p id={`${id}-active-help`} className="text-xs text-muted-foreground">
                When off, none of its items can be ordered.
              </p>
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend id={`${id}-channels`} tabIndex={-1} className="mb-1 text-sm font-medium outline-none">
              Order types
            </legend>
            {ORDER_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2.5">
                <Checkbox
                  id={`${id}-channel-${type}`}
                  checked={draft.channels[type]}
                  onCheckedChange={(checked) => update({ channels: { ...draft.channels, [type]: checked === true } })}
                />
                <Label htmlFor={`${id}-channel-${type}`} className="font-normal">
                  {orderTypeLabels[type]}
                </Label>
              </div>
            ))}
            {fieldError("channels")}
          </fieldset>

          <div className="flex flex-col gap-2 border-t pt-4">
            <h3 className="text-sm font-medium">When its items can be ordered</h3>
            {scheduleSupport && draft.schedule ? (
              <ScheduleEditor
                owner="category"
                value={draft.schedule}
                onChange={(schedule) => update({ schedule })}
                errors={errors}
                timeZone={scheduleSupport.timeZone}
                savedTimeZone={category?.schedule.mode === "custom" ? category.schedule.timeZone : undefined}
                itemChannels={draft.channels}
                newKey={newKey}
                mealPeriods={scheduleSupport.mealPeriods}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                The schedule can&apos;t be changed right now because the restaurant&apos;s time zone couldn&apos;t be loaded.
                Saving keeps the current schedule.
              </p>
            )}
          </div>

          {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={command.pending || undefined}>
              {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {editing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
