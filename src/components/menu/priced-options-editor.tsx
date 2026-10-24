"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OPTION_NAME_MAX, type OptionDraft, type OptionErrors } from "@/lib/menu/validation"

type PricedOptionsEditorProps = {
  /** Used for ids and labels, e.g. "variant" or "add-on". */
  kind: string
  title: string
  description: string
  emptyText: string
  namePlaceholder: string
  priceHelp: string
  options: OptionDraft[]
  errors?: OptionErrors
  onChange: (options: OptionDraft[]) => void
  /** Creates a stable key for a new row. */
  newKey: () => string
}

export function optionFieldId(kind: string, key: string, field: "name" | "price") {
  return `${kind}-${key}-${field}`
}

/**
 * Optional list of named, priced options (variants, add-ons). No minimum,
 * maximum or required selection is enforced: those rules aren't decided yet.
 */
export function PricedOptionsEditor({
  kind,
  title,
  description,
  emptyText,
  namePlaceholder,
  priceHelp,
  options,
  errors,
  onChange,
  newKey,
}: PricedOptionsEditorProps) {
  const update = (key: string, patch: Partial<OptionDraft>) =>
    onChange(options.map((option) => (option.key === key ? { ...option, ...patch } : option)))

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p id={`${kind}-price-help`} className="mt-1 text-xs text-muted-foreground">
          {priceHelp}
        </p>
      </div>

      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {options.map((option, index) => {
            const rowErrors = errors?.[option.key]
            const nameId = optionFieldId(kind, option.key, "name")
            const priceId = optionFieldId(kind, option.key, "price")
            return (
              <li
                key={option.key}
                className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-start"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={nameId}>
                    {title.replace(/s$/, "")} {index + 1} name
                  </Label>
                  <Input
                    id={nameId}
                    value={option.name}
                    onChange={(event) => update(option.key, { name: event.target.value })}
                    placeholder={namePlaceholder}
                    maxLength={OPTION_NAME_MAX + 20}
                    aria-invalid={rowErrors?.name ? true : undefined}
                    aria-describedby={rowErrors?.name ? `${nameId}-error` : undefined}
                    className="h-10 bg-background"
                  />
                  {rowErrors?.name ? (
                    <p id={`${nameId}-error`} className="text-xs text-destructive">
                      {rowErrors.name}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={priceId}>Price (₹)</Label>
                  <Input
                    id={priceId}
                    value={option.price}
                    onChange={(event) => update(option.key, { price: event.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={rowErrors?.price ? true : undefined}
                    aria-describedby={[
                      rowErrors?.price ? `${priceId}-error` : null,
                      `${kind}-price-help`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    className="h-10 bg-background tabular-nums"
                  />
                  {rowErrors?.price ? (
                    <p id={`${priceId}-error`} className="text-xs text-destructive">
                      {rowErrors.price}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(options.filter((entry) => entry.key !== option.key))}
                  aria-label={`Remove ${kind} ${index + 1}${option.name ? ` (${option.name})` : ""}`}
                  className="justify-self-end text-muted-foreground sm:mt-6"
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, { key: newKey(), name: "", price: "" }])}
        className="w-fit"
      >
        <Plus aria-hidden />
        Add {kind}
      </Button>
    </fieldset>
  )
}
