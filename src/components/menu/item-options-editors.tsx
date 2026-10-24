"use client"

import { AlertCircle, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  fieldId,
  MAX_GROUPS,
  MAX_OPTIONS_PER_GROUP,
  MAX_SIZES,
  OPTION_NAME_MAX,
  type FieldErrors,
  type GroupDraft,
  type OptionDraft,
  type SizeDraft,
} from "@/lib/menu/validation"

export function FieldError({ path, errors }: { path: string; errors: FieldErrors }) {
  const message = errors[path]
  return message ? (
    <p id={`${fieldId(path)}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
      <AlertCircle aria-hidden className="size-3.5 shrink-0" />
      {message}
    </p>
  ) : null
}

/** aria props for an input whose errors are keyed by `path`. */
export function errorProps(path: string, errors: FieldErrors, describedBy?: string) {
  const ids = [describedBy, errors[path] ? `${fieldId(path)}-error` : null].filter(Boolean)
  return {
    id: fieldId(path),
    "aria-invalid": errors[path] ? true : undefined,
    "aria-describedby": ids.length ? ids.join(" ") : undefined,
  }
}

/** A name + price + available row, shared by sizes and options. */
function PricedRow({
  path,
  label,
  index,
  row,
  errors,
  pricePlaceholder,
  priceLabel,
  onChange,
  onRemove,
}: {
  path: string
  label: string
  index: number
  row: SizeDraft | OptionDraft
  errors: FieldErrors
  pricePlaceholder: string
  priceLabel: string
  onChange: (row: SizeDraft | OptionDraft) => void
  onRemove: () => void
}) {
  const rowName = row.name.trim() || `${label} ${index + 1}`
  return (
    <li className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto] sm:items-start">
      <div className="grid gap-1.5">
        <Label htmlFor={fieldId(`${path}.name`)} className="text-xs">
          {label} name
        </Label>
        <Input
          {...errorProps(`${path}.name`, errors)}
          value={row.name}
          maxLength={OPTION_NAME_MAX + 20}
          onChange={(event) => onChange({ ...row, name: event.target.value })}
          className="h-9"
        />
        <FieldError path={`${path}.name`} errors={errors} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={fieldId(`${path}.price`)} className="text-xs">
          {priceLabel}
        </Label>
        <Input
          {...errorProps(`${path}.price`, errors)}
          value={row.price}
          inputMode="decimal"
          placeholder={pricePlaceholder}
          onChange={(event) => onChange({ ...row, price: event.target.value })}
          className="h-9 tabular-nums"
        />
        <FieldError path={`${path}.price`} errors={errors} />
      </div>
      <div className="flex items-center gap-2 sm:pt-6">
        <Switch
          id={fieldId(`${path}.available`)}
          checked={row.available}
          onCheckedChange={(checked) => onChange({ ...row, available: checked })}
        />
        <Label htmlFor={fieldId(`${path}.available`)} className="text-xs font-normal">
          Available
        </Label>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${rowName}`}
        onClick={onRemove}
        className="justify-self-end sm:mt-5"
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  )
}

export function SizesEditor({
  sizes,
  errors,
  onChange,
  newKey,
}: {
  sizes: SizeDraft[]
  errors: FieldErrors
  onChange: (sizes: SizeDraft[]) => void
  newKey: () => string
}) {
  return (
    <div className="flex flex-col gap-3">
      {sizes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sizes. The item is sold at the price above.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Sizes">
          {sizes.map((size, index) => (
            <PricedRow
              key={size.key}
              path={`sizes.${size.key}`}
              label="Size"
              index={index}
              row={size}
              errors={errors}
              priceLabel="Price (₹)"
              pricePlaceholder="0.00"
              onChange={(row) => onChange(sizes.map((candidate) => (candidate.key === size.key ? (row as SizeDraft) : candidate)))}
              onRemove={() => onChange(sizes.filter((candidate) => candidate.key !== size.key))}
            />
          ))}
        </ul>
      )}
      <FieldError path="sizes" errors={errors} />
      {sizes.length < MAX_SIZES ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...sizes, { key: newKey(), name: "", price: "", available: true }])}
        >
          <Plus aria-hidden />
          Add size
        </Button>
      ) : null}
    </div>
  )
}

function GroupEditor({
  group,
  index,
  errors,
  onChange,
  onRemove,
  newKey,
}: {
  group: GroupDraft
  index: number
  errors: FieldErrors
  onChange: (group: GroupDraft) => void
  onRemove: () => void
  newKey: () => string
}) {
  const path = `groups.${group.key}`
  const groupName = group.name.trim() || `Group ${index + 1}`
  const updateOption = (option: OptionDraft) =>
    onChange({ ...group, options: group.options.map((candidate) => (candidate.key === option.key ? option : candidate)) })

  return (
    <li>
      <fieldset className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
        <legend className="sr-only">{groupName}</legend>
        <div className="flex items-start gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor={fieldId(`${path}.name`)}>Group name</Label>
            <Input
              {...errorProps(`${path}.name`, errors)}
              value={group.name}
              placeholder="e.g. Extras or Spice level"
              maxLength={OPTION_NAME_MAX + 20}
              onChange={(event) => onChange({ ...group, name: event.target.value })}
              className="h-9 bg-background"
            />
            <FieldError path={`${path}.name`} errors={errors} />
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-6" onClick={onRemove}>
            <Trash2 aria-hidden />
            Remove group<span className="sr-only"> {groupName}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Customers choose</legend>
            <RadioGroup
              value={group.selection}
              onValueChange={(selection) => onChange({ ...group, selection: selection as GroupDraft["selection"] })}
              className="flex gap-4"
            >
              {(["single", "multiple"] as const).map((selection) => (
                <div key={selection} className="flex items-center gap-2">
                  <RadioGroupItem value={selection} id={fieldId(`${path}.selection.${selection}`)} />
                  <Label htmlFor={fieldId(`${path}.selection.${selection}`)} className="font-normal">
                    {selection === "single" ? "One option" : "Several options"}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              id={fieldId(`${path}.required`)}
              checked={group.required}
              onCheckedChange={(required) => onChange({ ...group, required })}
            />
            <Label htmlFor={fieldId(`${path}.required`)} className="font-normal">
              Required
            </Label>
          </div>
          {group.selection === "multiple" ? (
            <div className="flex gap-3">
              {group.required ? (
                <div className="grid w-24 gap-1.5">
                  <Label htmlFor={fieldId(`${path}.min`)} className="text-xs">
                    At least
                  </Label>
                  <Input
                    {...errorProps(`${path}.min`, errors)}
                    value={group.min}
                    inputMode="numeric"
                    onChange={(event) => onChange({ ...group, min: event.target.value })}
                    className="h-9 bg-background"
                  />
                </div>
              ) : null}
              <div className="grid w-24 gap-1.5">
                <Label htmlFor={fieldId(`${path}.max`)} className="text-xs">
                  At most
                </Label>
                <Input
                  {...errorProps(`${path}.max`, errors)}
                  value={group.max}
                  inputMode="numeric"
                  onChange={(event) => onChange({ ...group, max: event.target.value })}
                  className="h-9 bg-background"
                />
              </div>
            </div>
          ) : null}
        </div>
        <FieldError path={`${path}.min`} errors={errors} />
        <FieldError path={`${path}.max`} errors={errors} />
        <p className="text-xs text-muted-foreground">
          {group.selection === "single"
            ? group.required
              ? "The customer must pick exactly one."
              : "The customer can pick one, or none."
            : group.required
              ? "The customer picks between the minimum and maximum."
              : "The customer can pick up to the maximum, or none."}
        </p>

        <ul className="flex flex-col gap-2" aria-label={`Options in ${groupName}`}>
          {group.options.map((option, optionIndex) => (
            <PricedRow
              key={option.key}
              path={`${path}.options.${option.key}`}
              label="Option"
              index={optionIndex}
              row={option}
              errors={errors}
              priceLabel="Added price (₹)"
              pricePlaceholder="0 = free"
              onChange={(row) => updateOption(row as OptionDraft)}
              onRemove={() => onChange({ ...group, options: group.options.filter((candidate) => candidate.key !== option.key) })}
            />
          ))}
        </ul>
        <FieldError path={`${path}.options`} errors={errors} />
        {group.options.length < MAX_OPTIONS_PER_GROUP ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              onChange({ ...group, options: [...group.options, { key: newKey(), name: "", price: "", available: true }] })
            }
          >
            <Plus aria-hidden />
            Add option<span className="sr-only"> to {groupName}</span>
          </Button>
        ) : null}
      </fieldset>
    </li>
  )
}

export function OptionGroupsEditor({
  groups,
  errors,
  onChange,
  newKey,
}: {
  groups: GroupDraft[]
  errors: FieldErrors
  onChange: (groups: GroupDraft[]) => void
  newKey: () => string
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No option groups for this item.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Option groups">
          {groups.map((group, index) => (
            <GroupEditor
              key={group.key}
              group={group}
              index={index}
              errors={errors}
              newKey={newKey}
              onChange={(next) => onChange(groups.map((candidate) => (candidate.key === group.key ? next : candidate)))}
              onRemove={() => onChange(groups.filter((candidate) => candidate.key !== group.key))}
            />
          ))}
        </ul>
      )}
      <FieldError path="groups" errors={errors} />
      {groups.length < MAX_GROUPS ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            onChange([
              ...groups,
              {
                key: newKey(),
                name: "",
                selection: "single",
                required: false,
                min: "1",
                max: "2",
                options: [{ key: newKey(), name: "", price: "", available: true }],
              },
            ])
          }
        >
          <Plus aria-hidden />
          Add option group
        </Button>
      ) : null}
    </div>
  )
}
