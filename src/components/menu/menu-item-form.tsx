"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import type { ZoneAndLocale } from "@/lib/orders/format"
import {
  allergenLabels,
  dietaryLabels,
  HIDDEN_FROM_CUSTOMERS_NOTE,
  spiceLabels,
  tagLabels,
} from "@/lib/menu/labels"
import type { HoursForCheck } from "@/lib/menu/hours-warnings"
import type { MealPeriod } from "@/lib/menu/meal-periods"
import { listOrderTypes, scheduleDraftFrom, schedulePaths, WEEKDAYS } from "@/lib/menu/schedule"
import { ALLERGENS, DIETARY_TYPES, ITEM_TAGS, SPICE_LEVELS, type MenuCategory, type MenuItem } from "@/lib/menu/types"
import {
  DESCRIPTION_MAX,
  fieldId,
  hasErrors,
  ITEM_NAME_MAX,
  toPriceInput,
  validateMenuItemDraft,
  type FieldErrors,
  type MenuItemDraft,
  type SoldOutChoice,
} from "@/lib/menu/validation"

import { HoursCheckPanel } from "./hours-check-panel"
import { ImagePicker } from "./image-picker"
import { errorProps, FieldError, OptionGroupsEditor, SizesEditor } from "./item-options-editors"
import { soldOutUntilText } from "./item-status-badge"
import { ScheduleEditor } from "./schedule-editor"
import { SoldOutChoices } from "./sold-out-dialog"
import { useMenuCommand } from "./use-menu-command"

/** Keys for new rows; the server mints real ids. Only [\w-] so they survive parsing. */
const newKey = () => `new-${crypto.randomUUID().slice(0, 8)}`

function draftFrom(item: MenuItem | undefined): MenuItemDraft {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    categoryId: item?.categoryId ?? "",
    price: item && item.sizes.length === 0 ? toPriceInput(item.price.amountMinor) : "",
    sizes: (item?.sizes ?? []).map((size) => ({
      key: size.id,
      name: size.name,
      price: toPriceInput(size.price.amountMinor),
      available: size.available,
    })),
    groups: (item?.optionGroups ?? []).map((group) => ({
      key: group.id,
      name: group.name,
      selection: group.selection,
      required: group.required,
      min: String(group.min),
      max: String(group.max),
      options: group.options.map((option) => ({
        key: option.id,
        name: option.name,
        price: toPriceInput(option.price.amountMinor),
        available: option.available,
      })),
    })),
    dietary: item?.dietary ?? "veg",
    allergens: item?.allergens ?? [],
    spiceLevel: item?.spiceLevel ?? "none",
    tags: item?.tags ?? [],
    calories: item?.calories != null ? String(item.calories) : "",
    channels: item?.channels ?? { delivery: true, takeaway: true, dine_in: true },
    soldOut: item?.soldOut
      ? { state: "sold_out", until: "unchanged", reason: item.soldOut.reason ?? "" }
      : { state: "available" },
    schedule: item ? scheduleDraftFrom(item.schedule) : { mode: "always" },
    image: { kind: "keep" },
  }
}

// Field paths in the order they appear, for the error summary.
function summaryOrder(draft: MenuItemDraft) {
  const schedule = draft.schedule
  return [
    "name",
    "description",
    "categoryId",
    "price",
    "sizes",
    ...draft.sizes.flatMap((size) => [`sizes.${size.key}.name`, `sizes.${size.key}.price`]),
    "groups",
    ...draft.groups.flatMap((group) => [
      `groups.${group.key}.name`,
      `groups.${group.key}.min`,
      `groups.${group.key}.max`,
      `groups.${group.key}.options`,
      ...group.options.flatMap((option) => [
        `groups.${group.key}.options.${option.key}.name`,
        `groups.${group.key}.options.${option.key}.price`,
      ]),
    ]),
    "calories",
    "channels",
    schedulePaths.root,
    ...(schedule.mode === "custom"
      ? WEEKDAYS.flatMap((day) => [
          schedulePaths.day(day),
          schedulePaths.allDay(day),
          ...schedule.days[day].windows.flatMap((window) => [
            schedulePaths.start(day, window.key),
            schedulePaths.end(day, window.key),
            schedulePaths.window(day, window.key),
            schedulePaths.channels(day, window.key),
          ]),
        ])
      : []),
    ...(schedule.mode === "meal_periods"
      ? schedule.periods.flatMap((ref) => [schedulePaths.period(ref.periodId), schedulePaths.periodChannels(ref.periodId)])
      : []),
    "image",
    "soldOut.reason",
  ]
}

/** Field id an error-summary link focuses; the image's file input is hidden, so its "Choose image" button. */
const summaryTarget = (path: string) => (path === "image" ? `${fieldId("image")}-button` : fieldId(path))

/**
 * Create/edit form for a menu item (PRD §5). Validation runs here and again on
 * the server with the same rules; in preview mode a save is simulated and
 * labelled "Preview only, not saved to Foodi".
 */
export function MenuItemForm({
  mode,
  item,
  categories,
  context,
  mealPeriods,
  hours,
}: {
  mode: "create" | "edit"
  item?: MenuItem
  /** Null when categories couldn't be loaded. */
  categories: MenuCategory[] | null
  context: ZoneAndLocale
  /** B3b: null when meal periods couldn't be loaded. */
  mealPeriods: MealPeriod[] | null
  /** B3b: restaurant hours for the advisory check. */
  hours: HoursForCheck
}) {
  const router = useRouter()
  const command = useMenuCommand()
  const [draft, setDraft] = useState<MenuItemDraft>(() => draftFrom(item))
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const [attempted, setAttempted] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const serverErrors = command.fieldErrors
  const errors: FieldErrors = { ...serverErrors, ...localErrors }
  const activeCategories = categories?.filter((category) => !category.archived) ?? null
  const category = categories?.find((candidate) => candidate.id === draft.categoryId) ?? null

  function update(patch: Partial<MenuItemDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    // After a failed attempt, keep errors in step with what the user fixes.
    if (attempted) setLocalErrors(validateMenuItemDraft(next))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    const nextErrors = validateMenuItemDraft(draft)
    setLocalErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    const name = draft.name.trim()
    command.run(
      { type: "save_item", itemId: item?.id ?? null, draft },
      mode === "create" ? `${name} added to the menu` : `${name} updated`,
      () => router.push("/menu")
    )
  }

  const order = summaryOrder(draft)
  const entries = attempted
    ? Object.entries(errors).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    : []
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

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
            {entries.map(([path, message]) => (
              <li key={path}>
                <a
                  href={`#${summaryTarget(path)}`}
                  onClick={(event) => {
                    event.preventDefault()
                    document.getElementById(summaryTarget(path))?.focus()
                  }}
                  className="underline underline-offset-2"
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <FormSection title="Item details" description="Fields marked Required must be filled in.">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor={fieldId("name")} required>
                Item name
              </FieldLabel>
              <Input
                {...errorProps("name", errors)}
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                maxLength={ITEM_NAME_MAX + 20}
                autoComplete="off"
                aria-required="true"
                className="h-10 bg-background"
              />
              <FieldError path="name" errors={errors} />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor={fieldId("description")}>Description</FieldLabel>
              <Textarea
                {...errorProps("description", errors, "item-description-count")}
                value={draft.description}
                onChange={(event) => update({ description: event.target.value })}
                rows={3}
                className="bg-background"
              />
              <p id="item-description-count" className="text-xs text-muted-foreground">
                {draft.description.trim().length} of {DESCRIPTION_MAX} characters
              </p>
              <FieldError path="description" errors={errors} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor={fieldId("categoryId")} required>
                  Category
                </FieldLabel>
                <NativeSelect
                  {...errorProps("categoryId", errors)}
                  value={draft.categoryId}
                  onChange={(event) => update({ categoryId: event.target.value })}
                  disabled={!activeCategories}
                  aria-required="true"
                  className="h-10 bg-background"
                >
                  <option value="">Choose a category</option>
                  {activeCategories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.active ? "" : " (switched off)"}
                    </option>
                  ))}
                </NativeSelect>
                {!activeCategories ? (
                  <p className="text-xs text-muted-foreground">Categories aren&apos;t connected yet.</p>
                ) : null}
                <FieldError path="categoryId" errors={errors} />
              </div>
              <div className="flex flex-col gap-2">
                {draft.sizes.length === 0 ? (
                  <>
                    <FieldLabel htmlFor={fieldId("price")} required>
                      Price (₹)
                    </FieldLabel>
                    <Input
                      {...errorProps("price", errors)}
                      value={draft.price}
                      onChange={(event) => update({ price: event.target.value })}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-required="true"
                      className="h-10 bg-background tabular-nums"
                    />
                    <FieldError path="price" errors={errors} />
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">Price (₹)</span>
                    <p id={fieldId("price")} className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      Set by sizes below. The customer pays the price of the size they pick.
                    </p>
                  </>
                )}
              </div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Food type</legend>
              <RadioGroup
                value={draft.dietary}
                onValueChange={(dietary) => update({ dietary: dietary as MenuItemDraft["dietary"] })}
                className="flex flex-wrap gap-4"
              >
                {DIETARY_TYPES.map((dietary) => (
                  <div key={dietary} className="flex items-center gap-2">
                    <RadioGroupItem value={dietary} id={fieldId(`dietary.${dietary}`)} />
                    <Label htmlFor={fieldId(`dietary.${dietary}`)} className="font-normal">
                      {dietaryLabels[dietary]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          </FormSection>

          <FormSection
            title="Sizes"
            optional
            description="Use sizes when the item comes in portions, like Half and Full. The customer picks exactly one, and its price replaces the price above."
          >
            <SizesEditor sizes={draft.sizes} errors={errors} newKey={newKey} onChange={(sizes) => update({ sizes })} />
          </FormSection>

          <FormSection
            title="Option groups"
            optional
            description="Choices and extras, like a spice level or toppings. Each option adds its price (0 for free)."
          >
            <OptionGroupsEditor groups={draft.groups} errors={errors} newKey={newKey} onChange={(groups) => update({ groups })} />
          </FormSection>

          <FormSection title="More details" optional>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor={fieldId("spiceLevel")}>Spice level</FieldLabel>
                <NativeSelect
                  id={fieldId("spiceLevel")}
                  value={draft.spiceLevel}
                  onChange={(event) => update({ spiceLevel: event.target.value as MenuItemDraft["spiceLevel"] })}
                  className="h-10 bg-background"
                >
                  {SPICE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {spiceLabels[level]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor={fieldId("calories")}>Calories (kcal per serving)</FieldLabel>
                <Input
                  {...errorProps("calories", errors)}
                  value={draft.calories}
                  inputMode="numeric"
                  onChange={(event) => update({ calories: event.target.value })}
                  className="h-10 bg-background tabular-nums"
                />
                <FieldError path="calories" errors={errors} />
              </div>
            </div>
            <CheckboxGroup
              legend="Tags"
              options={ITEM_TAGS.map((tag) => ({ value: tag, label: tagLabels[tag] }))}
              values={draft.tags}
              onChange={(tags) => update({ tags: tags as MenuItemDraft["tags"] })}
            />
            <CheckboxGroup
              legend="Allergens"
              options={ALLERGENS.map((allergen) => ({ value: allergen, label: allergenLabels[allergen] }))}
              values={draft.allergens}
              onChange={(allergens) => update({ allergens: allergens as MenuItemDraft["allergens"] })}
            />
          </FormSection>

          <FormSection title="Order types and schedule" description="How and when customers can order this item.">
            <ItemOrderTypes draft={draft} category={category} errors={errors} onChange={update} />
            <ScheduleEditor
              value={draft.schedule}
              onChange={(schedule) => update({ schedule })}
              errors={errors}
              timeZone={context.timeZone}
              savedTimeZone={item?.schedule.mode === "custom" ? item.schedule.timeZone : undefined}
              itemChannels={draft.channels}
              newKey={newKey}
              mealPeriods={mealPeriods}
            />
            <HoursCheckPanel
              draft={draft}
              categories={categories}
              mealPeriods={mealPeriods}
              hours={hours}
              timeZone={context.timeZone}
            />
          </FormSection>
        </div>

        <div className="flex flex-col gap-6">
          <FormSection title="Image" optional>
            <ImagePicker
              currentUrl={item?.imageUrl ?? null}
              value={draft.image}
              onChange={(image) => update({ image })}
              error={errors.image}
            />
          </FormSection>

          <FormSection title="Availability">
            <AvailabilityFields draft={draft} item={item} errors={errors} context={context} onChange={update} />
          </FormSection>
        </div>
      </div>

      {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="ghost">
          <Link href="/menu">Cancel</Link>
        </Button>
        <Button type="submit" className="sm:min-w-36" aria-disabled={command.pending || undefined}>
          {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {mode === "create" ? "Add item" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function AvailabilityFields({
  draft,
  item,
  errors,
  context,
  onChange,
}: {
  draft: MenuItemDraft
  item?: MenuItem
  errors: FieldErrors
  context: ZoneAndLocale
  onChange: (patch: Partial<MenuItemDraft>) => void
}) {
  const soldOut = draft.soldOut
  const existing = item?.soldOut
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Switch
          id={fieldId("available")}
          checked={soldOut.state === "available"}
          aria-describedby="item-available-help"
          onCheckedChange={(available) =>
            onChange({
              soldOut: available
                ? { state: "available" }
                : { state: "sold_out", until: existing ? "unchanged" : "next_opening", reason: existing?.reason ?? "" },
            })
          }
          className="mt-0.5"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId("available")}>Available now</Label>
          <p id="item-available-help" className="text-xs leading-relaxed text-muted-foreground">
            Turn off to mark it sold out. {HIDDEN_FROM_CUSTOMERS_NOTE} Orders already placed aren&apos;t changed.
          </p>
        </div>
      </div>

      {soldOut.state === "sold_out" ? (
        <SoldOutChoices
          idPrefix="item-sold-out"
          value={soldOut.until}
          onChange={(until) => onChange({ soldOut: { ...soldOut, until: until as SoldOutChoice | "unchanged" } })}
          reason={soldOut.reason}
          onReasonChange={(reason) => onChange({ soldOut: { ...soldOut, reason } })}
          reasonError={errors["soldOut.reason"]}
          extraChoice={
            existing ? { value: "unchanged", label: `Keep as is: sold out ${soldOutUntilText(existing.until, context)}` } : undefined
          }
        />
      ) : null}
    </div>
  )
}

/**
 * The item's own order types (PRD §3.4 Channels). Schedule windows narrow
 * these. B3b: the category is the outer limit. An order type that's off for
 * the category can't be turned on here; one the item already has stays as
 * configured (the save rule is unchanged), and the editor shows that it
 * isn't orderable.
 */
function ItemOrderTypes({
  draft,
  category,
  errors,
  onChange,
}: {
  draft: MenuItemDraft
  category: MenuCategory | null
  errors: FieldErrors
  onChange: (patch: Partial<MenuItemDraft>) => void
}) {
  const offForCategory = category ? ORDER_TYPES.filter((type) => !category.channels[type]) : []
  const configured = ORDER_TYPES.filter((type) => draft.channels[type])
  const effective = configured.filter((type) => !offForCategory.includes(type))
  const kept = configured.filter((type) => offForCategory.includes(type))
  const describedBy = [
    "item-channels-help",
    offForCategory.length ? "item-channels-category" : null,
    errors.channels ? `${fieldId("channels")}-error` : null,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <fieldset className="grid gap-2" aria-describedby={describedBy}>
      <legend id={fieldId("channels")} tabIndex={-1} className="text-sm font-medium outline-none">
        Order types
      </legend>
      <p id="item-channels-help" className="text-xs text-muted-foreground">
        What the item is offered for. A schedule can narrow these by time, never add to them.
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {ORDER_TYPES.map((type) => {
          const off = offForCategory.includes(type)
          return (
            <div key={type} className="flex items-center gap-2.5">
              <Checkbox
                id={fieldId(`channels.${type}`)}
                checked={draft.channels[type]}
                // A child never turns on what its category has off; an existing setting can still be cleared.
                disabled={off && !draft.channels[type]}
                onCheckedChange={(checked) => onChange({ channels: { ...draft.channels, [type]: checked === true } })}
              />
              <Label htmlFor={fieldId(`channels.${type}`)} className="font-normal">
                {orderTypeLabels[type]}
                {off ? <span className="text-xs text-muted-foreground">(off for category)</span> : null}
              </Label>
            </div>
          )
        })}
      </div>
      {category && offForCategory.length ? (
        <div id="item-channels-category" className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <p>
            {listOrderTypes(offForCategory)} {offForCategory.length === 1 ? "is" : "are"} off for the {category.name}{" "}
            category, so this item can&apos;t be ordered for {offForCategory.length === 1 ? "it" : "them"}.
          </p>
          {kept.length ? (
            <p className="mt-1">
              Configured: {listOrderTypes(configured)}. Orderable for: {effective.length ? listOrderTypes(effective) : "none"}.
              The item&apos;s setting for {listOrderTypes(kept)} is kept and applies again if the category turns{" "}
              {kept.length === 1 ? "it" : "them"} back on.
            </p>
          ) : null}
        </div>
      ) : null}
      <FieldError path="channels" errors={errors} />
    </fieldset>
  )
}

function CheckboxGroup({
  legend,
  options,
  values,
  onChange,
}: {
  legend: string
  options: { value: string; label: string }[]
  values: readonly string[]
  onChange: (values: string[]) => void
}) {
  const id = `item-${legend.toLowerCase()}`
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2.5">
            <Checkbox
              id={`${id}-${option.value}`}
              checked={values.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(checked === true ? [...values, option.value] : values.filter((value) => value !== option.value))
              }
            />
            <Label htmlFor={`${id}-${option.value}`} className="font-normal">
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
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
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Required</span>
      ) : (
        <span className="text-xs font-normal text-muted-foreground">Optional</span>
      )}
    </Label>
  )
}
