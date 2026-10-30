"use client"

import { useId, useState } from "react"
import { Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { formatMoney } from "@/lib/orders/format"
import type { MenuItem } from "@/lib/menu/types"

import { lineFrom, lineTotal, selectionProblems, type CartLine, type Selection } from "./pos-cart"

/**
 * Sizes, option groups, quantity and a note for one item, using the item's own menu rules. The price shown
 * is the menu price; Foodi works out discounts, taxes and charges when an order is placed.
 */
export function PosItemDialog({
  item,
  locale,
  onAdd,
  onClose,
}: {
  item: MenuItem
  locale: string
  onAdd: (line: Omit<CartLine, "key">) => void
  onClose: () => void
}) {
  const id = useId()
  const [selection, setSelection] = useState<Selection>({ sizeId: null, options: {}, quantity: 1, note: "" })
  const [attempted, setAttempted] = useState(false)
  const problems = selectionProblems(item, selection)
  const preview = lineFrom(item, selection, "preview")

  const toggle = (groupId: string, optionId: string, single: boolean, on: boolean) => {
    const current = selection.options[groupId] ?? []
    const next = single ? (on ? [optionId] : []) : on ? [...current, optionId] : current.filter((value) => value !== optionId)
    setSelection({ ...selection, options: { ...selection.options, [groupId]: next } })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            setAttempted(true)
            if (problems.length > 0) return
            const { key: _key, ...line } = lineFrom(item, selection, "new")
            void _key
            onAdd(line)
          }}
        >
          <DialogHeader>
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>{item.description ?? "Choose how this item is made, then add it to the order."}</DialogDescription>
          </DialogHeader>

          {item.sizes.length > 0 ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Size</legend>
              <RadioGroup value={selection.sizeId ?? ""} onValueChange={(sizeId) => setSelection({ ...selection, sizeId })} className="gap-2">
                {item.sizes.map((size) => (
                  <div key={size.id} className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2.5 ring-1 ring-border-soft">
                    <div className="flex items-center gap-2.5">
                      <RadioGroupItem value={size.id} id={`${id}-size-${size.id}`} disabled={!size.available} />
                      <Label htmlFor={`${id}-size-${size.id}`} className="font-normal">
                        {size.name}
                        {!size.available ? <span className="text-xs text-muted-foreground"> (unavailable)</span> : null}
                      </Label>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(size.price, locale)}</span>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          ) : null}

          {item.optionGroups.map((group) => {
            const single = group.selection === "single"
            const chosen = selection.options[group.id] ?? []
            return (
              <fieldset key={group.id} className="grid gap-2">
                <legend className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {group.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {group.required ? "Required" : "Optional"}
                    {!single ? `, up to ${group.max}` : ""}
                  </span>
                </legend>
                {group.options.map((option) => {
                  const optionId = `${id}-${group.id}-${option.id}`
                  const atMax = !single && !chosen.includes(option.id) && chosen.length >= group.max
                  return (
                    <div key={option.id} className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2.5 ring-1 ring-border-soft">
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          id={optionId}
                          checked={chosen.includes(option.id)}
                          disabled={!option.available || atMax}
                          onCheckedChange={(checked) => toggle(group.id, option.id, single, checked === true)}
                        />
                        <Label htmlFor={optionId} className="font-normal">
                          {option.name}
                          {!option.available ? <span className="text-xs text-muted-foreground"> (unavailable)</span> : null}
                        </Label>
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {option.price.amountMinor > 0 ? `+${formatMoney(option.price, locale)}` : "Free"}
                      </span>
                    </div>
                  )
                })}
              </fieldset>
            )
          })}

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-note`} className="gap-2">
              Note for the kitchen <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Textarea
              id={`${id}-note`}
              rows={2}
              maxLength={200}
              value={selection.note}
              onChange={(event) => setSelection({ ...selection, note: event.target.value })}
              placeholder="For example: no onions"
            />
          </div>

          {attempted && problems.length > 0 ? (
            <ul role="alert" className="list-disc rounded-2xl border border-danger-line bg-danger-soft py-3 pr-4 pl-8 text-sm text-danger-foreground">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}

          <DialogFooter className="sm:items-center sm:justify-between">
            <div className="flex items-center gap-2" role="group" aria-label="Quantity">
              <Button type="button" variant="outline" size="icon" aria-label="Decrease quantity" disabled={selection.quantity <= 1} onClick={() => setSelection({ ...selection, quantity: selection.quantity - 1 })}>
                <Minus aria-hidden />
              </Button>
              <span className="min-w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">
                {selection.quantity}
              </span>
              <Button type="button" variant="outline" size="icon" aria-label="Increase quantity" disabled={selection.quantity >= 50} onClick={() => setSelection({ ...selection, quantity: selection.quantity + 1 })}>
                <Plus aria-hidden />
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="lg">
                Add · {formatMoney({ amountMinor: lineTotal(preview), currency: preview.currency }, locale)}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
