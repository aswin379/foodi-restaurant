"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, PlugZap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { BACKEND_PENDING_MESSAGE } from "@/lib/menu/labels"
import type { MenuCategory, MenuItem } from "@/lib/menu/types"
import {
  DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  hasErrors,
  toPriceInput,
  validateMenuItemDraft,
  type MenuItemDraft,
  type MenuItemErrors,
  type OptionErrors,
} from "@/lib/menu/validation"

import { ImagePicker } from "./image-picker"
import { PricedOptionsEditor, optionFieldId } from "./priced-options-editor"

type Outcome = "idle" | "invalid" | "pending"

function draftFrom(item: MenuItem | undefined): MenuItemDraft {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    categoryId: item?.categoryId ?? "",
    price: item ? toPriceInput(item.price.amountMinor) : "",
    // PROVISIONAL default for new items (M5).
    available: item ? item.availability === "available" : true,
    variants: (item?.variants ?? []).map((variant) => ({
      key: variant.id,
      name: variant.name,
      price: toPriceInput(variant.price.amountMinor),
    })),
    addOns: (item?.addOns ?? []).map((addOn) => ({
      key: addOn.id,
      name: addOn.name,
      price: toPriceInput(addOn.price.amountMinor),
    })),
  }
}

type SummaryEntry = { fieldId: string; message: string }

function summaryEntries(errors: MenuItemErrors, draft: MenuItemDraft): SummaryEntry[] {
  const entries: SummaryEntry[] = []
  if (errors.name) entries.push({ fieldId: "item-name", message: errors.name })
  if (errors.description) entries.push({ fieldId: "item-description", message: errors.description })
  if (errors.price) entries.push({ fieldId: "item-price", message: errors.price })
  const options = (kind: string, label: string, list: MenuItemDraft["variants"], optionErrors?: OptionErrors) =>
    list.forEach((option, index) => {
      const entry = optionErrors?.[option.key]
      if (entry?.name) entries.push({ fieldId: optionFieldId(kind, option.key, "name"), message: `${label} ${index + 1}: ${entry.name}` })
      if (entry?.price) entries.push({ fieldId: optionFieldId(kind, option.key, "price"), message: `${label} ${index + 1}: ${entry.price}` })
    })
  options("variant", "Variant", draft.variants, errors.variants)
  options("add-on", "Add-on", draft.addOns, errors.addOns)
  return entries
}

/**
 * Create/edit form for a menu item. Validation runs locally; submitting never
 * saves anything. A valid submission stops with "Backend integration pending".
 */
export function MenuItemForm({
  mode,
  item,
  categories,
}: {
  mode: "create" | "edit"
  item?: MenuItem
  /** Null when categories couldn't be loaded. */
  categories: MenuCategory[] | null
}) {
  const keyPrefix = useId()
  const nextKey = useRef(0)
  const newKey = () => `${keyPrefix}-new-${nextKey.current++}`

  const [draft, setDraft] = useState<MenuItemDraft>(() => draftFrom(item))
  const [errors, setErrors] = useState<MenuItemErrors>({})
  const [outcome, setOutcome] = useState<Outcome>("idle")
  const summaryRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<HTMLDivElement>(null)

  function update(patch: Partial<MenuItemDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    // After a failed attempt, keep errors in step with what the user fixes.
    if (outcome === "invalid") {
      const nextErrors = validateMenuItemDraft(next)
      setErrors(nextErrors)
      if (!hasErrors(nextErrors)) setOutcome("idle")
    } else if (outcome === "pending") {
      setOutcome("idle")
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateMenuItemDraft(draft)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      setOutcome("invalid")
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    // No API exists: stop here and say so. Nothing is persisted.
    setOutcome("pending")
    requestAnimationFrame(() => pendingRef.current?.focus())
  }

  const entries = outcome === "invalid" ? summaryEntries(errors, draft) : []
  const fieldError = (id: string, message?: string) =>
    message ? (
      <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
        <AlertCircle aria-hidden className="size-3.5 shrink-0" />
        {message}
      </p>
    ) : null

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {entries.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="item-errors-title"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30"
        >
          <p id="item-errors-title" className="font-semibold text-destructive">
            Fix {entries.length === 1 ? "this problem" : `these ${entries.length} problems`} before saving
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-destructive">
            {entries.map((entry) => (
              <li key={entry.fieldId}>
                <a
                  href={`#${entry.fieldId}`}
                  onClick={(event) => {
                    event.preventDefault()
                    document.getElementById(entry.fieldId)?.focus()
                  }}
                  className="underline underline-offset-2"
                >
                  {entry.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <FormSection title="Item details" description="Fields marked Required must be filled in. Everything else is optional.">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="item-name" required>Item name</FieldLabel>
              <Input
                id="item-name"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                maxLength={ITEM_NAME_MAX + 20}
                autoComplete="off"
                aria-required="true"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "item-name-error" : undefined}
                className="h-10 bg-background"
              />
              {fieldError("item-name", errors.name)}
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="item-description">Description</FieldLabel>
              <Textarea
                id="item-description"
                value={draft.description}
                onChange={(event) => update({ description: event.target.value })}
                rows={3}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={["item-description-count", errors.description ? "item-description-error" : null].filter(Boolean).join(" ")}
                className="bg-background"
              />
              <p id="item-description-count" className="text-xs text-muted-foreground">
                {draft.description.trim().length} of {DESCRIPTION_MAX} characters
              </p>
              {fieldError("item-description", errors.description)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="item-category">Category</FieldLabel>
                <NativeSelect
                  id="item-category"
                  value={draft.categoryId}
                  onChange={(event) => update({ categoryId: event.target.value })}
                  disabled={!categories}
                  aria-describedby="item-category-help"
                  className="h-10 bg-background"
                >
                  <option value="">No category</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </NativeSelect>
                <p id="item-category-help" className="text-xs text-muted-foreground">
                  {categories
                    ? "Whether every item must be in a category isn't decided yet."
                    : "Categories aren't connected yet."}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="item-price" required>Price (₹)</FieldLabel>
                <Input
                  id="item-price"
                  value={draft.price}
                  onChange={(event) => update({ price: event.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-required="true"
                  aria-invalid={errors.price ? true : undefined}
                  aria-describedby={errors.price ? "item-price-error" : undefined}
                  className="h-10 bg-background tabular-nums"
                />
                {fieldError("item-price", errors.price)}
              </div>
            </div>
          </FormSection>

          <FormSection title="Variants" optional description="Use variants when the same item comes in versions, like sizes or portions. Most items don't need any.">
            <PricedOptionsEditor
              kind="variant"
              title="Variants"
              description="Example: Half and Full portions."
              emptyText="No variants. The item is sold at its price above."
              namePlaceholder="e.g. Half"
              priceHelp="How a variant price combines with the item price isn't decided yet."
              options={draft.variants}
              errors={errors.variants}
              onChange={(variants) => update({ variants })}
              newKey={newKey}
            />
          </FormSection>

          <FormSection title="Add-ons" optional description="Extras a customer could add to this item, like a side or extra topping.">
            <PricedOptionsEditor
              kind="add-on"
              title="Add-ons"
              description="Example: Raita, Extra cheese."
              emptyText="No add-ons for this item."
              namePlaceholder="e.g. Extra cheese"
              priceHelp="Grouping add-ons and limiting how many a customer can pick isn't decided yet."
              options={draft.addOns}
              errors={errors.addOns}
              onChange={(addOns) => update({ addOns })}
              newKey={newKey}
            />
          </FormSection>
        </div>

        <div className="flex flex-col gap-6">
          <FormSection title="Image" optional>
            <ImagePicker initialUrl={item?.imageUrl ?? null} />
          </FormSection>

          <FormSection title="Availability">
            <div className="flex items-start gap-3">
              <Checkbox
                id="item-available"
                checked={draft.available}
                onCheckedChange={(checked) => update({ available: checked === true })}
                aria-describedby="item-available-help"
                className="mt-0.5 size-[18px]"
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-available" className="cursor-pointer">
                  Available to order
                </Label>
                <p id="item-available-help" className="text-xs leading-relaxed text-muted-foreground">
                  Part of this form only. It changes nothing until the item can be saved.
                </p>
              </div>
            </div>
          </FormSection>
        </div>
      </div>

      {outcome === "pending" ? (
        <div
          ref={pendingRef}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 outline-none focus-visible:ring-[3px] focus-visible:ring-amber-400/50"
        >
          <PlugZap aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold">Not saved.</span> {BACKEND_PENDING_MESSAGE} Your
            entries are still on this page but will be lost if you leave it.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="ghost">
          <Link href="/menu">Cancel</Link>
        </Button>
        <Button type="submit" className="sm:min-w-36">
          {mode === "create" ? "Save item" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function FormSection({
  title,
  description,
  optional = false,
  children,
}: {
  title: string
  description?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="gap-5 shadow-none">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {title}
            {optional ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
          </h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  )
}

function FieldLabel({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className="gap-2">
      {children}
      {required ? (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          Required
        </span>
      ) : (
        <span className="text-xs font-normal text-muted-foreground">Optional</span>
      )}
    </Label>
  )
}
