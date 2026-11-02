"use client"

import { useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { notify } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { createCategory, updateCategory } from "../category-service"
import type { Category } from "../types"

const CATEGORY_NAME_MIN = 2
const CATEGORY_NAME_MAX = 100
const DESCRIPTION_MAX = 500

interface CategoryFormProps {
  category?: Category | null
  onClose: () => void
  onSaved: (category: Category) => void
}

function CategoryForm({ category, onClose, onSaved }: CategoryFormProps) {
  const id = useId()
  const isEditing = Boolean(category)

  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFieldError("Category name is required.")
      return
    }
    if (trimmedName.length < CATEGORY_NAME_MIN) {
      setFieldError(`Category name must be at least ${CATEGORY_NAME_MIN} characters.`)
      return
    }
    if (trimmedName.length > CATEGORY_NAME_MAX) {
      setFieldError(`Category name must be under ${CATEGORY_NAME_MAX} characters.`)
      return
    }

    const trimmedDesc = description.trim() || null
    if (trimmedDesc && trimmedDesc.length > DESCRIPTION_MAX) {
      setFieldError(`Keep the description under ${DESCRIPTION_MAX} characters.`)
      return
    }

    setFieldError(null)
    setGeneralError(null)
    setPending(true)

    try {
      const saved = isEditing && category
        ? await updateCategory(category.id, { name: trimmedName, description: trimmedDesc })
        : await createCategory({ name: trimmedName, description: trimmedDesc })

      notify({
        kind: "success",
        title: isEditing ? `Category "${trimmedName}" updated` : `Category "${trimmedName}" added`,
        preview: false,
      })
      onSaved(saved)
      onClose()
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit Category" : "Add Category"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update the category name or description."
            : "Categories group items on your menu, like Starters, Main Course, or Desserts."}
        </DialogDescription>
      </DialogHeader>

      {generalError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          <span>{generalError}</span>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-name`} className="text-sm font-medium">
              Category Name <span className="text-destructive">*</span>
            </Label>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Required
            </span>
          </div>
          <Input
            id={`${id}-name`}
            name="name"
            placeholder="e.g. Salads, Main Course, Beverages"
            value={name}
            maxLength={CATEGORY_NAME_MAX + 10}
            autoComplete="off"
            aria-required="true"
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? `${id}-name-error` : undefined}
            onChange={(e) => {
              setName(e.target.value)
              if (fieldError) setFieldError(null)
            }}
            className="h-10"
          />
          {fieldError && (
            <p id={`${id}-name-error`} className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle aria-hidden className="size-3.5" />
              {fieldError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-description`} className="text-sm font-medium">
              Description
            </Label>
            <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </div>
          <Textarea
            id={`${id}-description`}
            name="description"
            rows={3}
            placeholder="Brief description of this category (e.g. Refreshing greens and house dressings)..."
            value={description}
            maxLength={DESCRIPTION_MAX + 50}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {description.length}/{DESCRIPTION_MAX}
          </p>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 aria-hidden className="mr-1.5 size-4 animate-spin" />}
          {isEditing ? "Save changes" : "Add category"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  onSaved: (category: Category) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <CategoryForm
          key={category?.id ?? "new"}
          category={category}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

