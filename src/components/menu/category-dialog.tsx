"use client"

import { useId, useState } from "react"
import { AlertCircle, PlugZap } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BACKEND_PENDING_MESSAGE } from "@/lib/menu/labels"
import type { MenuCategory } from "@/lib/menu/types"
import {
  CATEGORY_NAME_MAX,
  validateCategoryDraft,
  type CategoryDraft,
  type CategoryErrors,
} from "@/lib/menu/validation"

/**
 * Add or edit a category. Validation runs locally; a valid submission stops
 * with "Backend integration pending" and the dialog stays open. Cancel or
 * Escape closes it without changing anything.
 */
export function CategoryDialog({
  category,
  trigger,
}: {
  category?: MenuCategory
  trigger: React.ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CategoryDraft>({ name: "", description: "" })
  const [errors, setErrors] = useState<CategoryErrors>({})
  const [pending, setPending] = useState(false)

  function onOpenChange(next: boolean) {
    if (next) {
      // Start from the saved values each time; nothing carries over.
      setDraft({ name: category?.name ?? "", description: category?.description ?? "" })
      setErrors({})
      setPending(false)
    }
    setOpen(next)
  }

  function update(patch: Partial<CategoryDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    setPending(false)
    if (errors.name || errors.description) setErrors(validateCategoryDraft(next))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateCategoryDraft(draft)
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.description) {
      document.getElementById(nextErrors.name ? `${id}-name` : `${id}-description`)?.focus()
      return
    }
    setPending(true)
  }

  const editing = Boolean(category)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${category?.name}` : "Add category"}</DialogTitle>
            <DialogDescription>
              Categories group items on your menu, like Starters or Drinks.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-name`} className="gap-2">
              Category name
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Required
              </span>
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
            {errors.name ? (
              <p id={`${id}-name-error`} className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle aria-hidden className="size-3.5" />
                {errors.name}
              </p>
            ) : null}
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
              rows={3}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? `${id}-description-error` : undefined}
            />
            {errors.description ? (
              <p id={`${id}-description-error`} className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle aria-hidden className="size-3.5" />
                {errors.description}
              </p>
            ) : null}
          </div>

          {pending ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
            >
              <PlugZap aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">Not saved.</span> {BACKEND_PENDING_MESSAGE}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{editing ? "Save changes" : "Add category"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
