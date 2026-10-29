"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Info, Loader2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import { listOrderTypes } from "@/lib/menu/schedule"
import { formatMoney } from "@/lib/orders/format"
import type { OrderSettings } from "@/lib/settings/types"
import {
  hasErrors,
  orderSettingsDraftFrom,
  orderSettingsPaths,
  settingsFieldId,
  turnedOff,
  validateOrderSettingsDraft,
  type FieldErrors,
  type OrderSettingsDraft,
} from "@/lib/settings/validation"

import { FieldError, Section } from "./profile-form"
import { useSettingsCommand } from "./use-settings-command"

const ORDER = [
  orderSettingsPaths.orderTypes,
  ...ORDER_TYPES.map((type) => orderSettingsPaths.prep(type)),
  orderSettingsPaths.minimumOrder,
]

/**
 * Order types, one restaurant-wide minimum order (D5), default prep time per
 * order type and the pickup-code requirement (D2). These are configured
 * settings: whether customers can order is decided by Foodi from them and
 * from hours, pauses and the menu (D6). Turning an order type off asks first
 * and changes nothing else. In preview mode the save is simulated.
 */
export function OrderSettingsForm({ settings, currency, locale }: { settings: OrderSettings; currency: string; locale: string }) {
  const command = useSettingsCommand()
  const [draft, setDraft] = useState<OrderSettingsDraft>(() => orderSettingsDraftFrom(settings))
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  const errors: FieldErrors = { ...command.fieldErrors, ...localErrors }
  const off = turnedOff(settings, draft)

  function update(next: OrderSettingsDraft) {
    setDraft(next)
    if (attempted) setLocalErrors(validateOrderSettingsDraft(next))
  }

  const save = () => command.run({ type: "save_order_settings", version: settings.version, draft }, "Order settings updated")

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    const next = validateOrderSettingsDraft(draft)
    setLocalErrors(next)
    if (hasErrors(next)) {
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    // D6: warn before turning an order type off; nothing else is changed by it.
    if (off.length) setConfirmOff(true)
    else save()
  }

  const entries = attempted ? ORDER.filter((path) => errors[path]).map((path) => [path, errors[path]] as const) : []
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null
  const typesId = settingsFieldId(orderSettingsPaths.orderTypes)
  const minimumId = settingsFieldId(orderSettingsPaths.minimumOrder)
  const savedOn = ORDER_TYPES.filter((type) => settings.orderTypes[type].enabled)
  const savedOff = ORDER_TYPES.filter((type) => !settings.orderTypes[type].enabled)

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {entries.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="order-settings-errors-title"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30"
        >
          <p id="order-settings-errors-title" className="font-semibold text-destructive">
            Fix {entries.length === 1 ? "this problem" : `these ${entries.length} problems`} before saving
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-destructive">
            {entries.map(([path, message]) => (
              <li key={path}>
                <a
                  href={`#${settingsFieldId(path)}`}
                  onClick={(event) => {
                    event.preventDefault()
                    document.getElementById(settingsFieldId(path))?.focus()
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

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section
            title="Order types and prep times"
            description="Which order types the restaurant offers, and the prep time each starts with."
          >
            <fieldset className="flex flex-col gap-3" aria-describedby={errors[orderSettingsPaths.orderTypes] ? `${typesId}-error` : undefined}>
              <legend id={typesId} tabIndex={-1} className="sr-only outline-none">
                Order types
              </legend>
              <ul className="flex flex-col gap-3">
                {ORDER_TYPES.map((type) => {
                  const label = orderTypeLabels[type]
                  const prepPath = orderSettingsPaths.prep(type)
                  const prepId = settingsFieldId(prepPath)
                  const entry = draft.orderTypes[type]
                  return (
                    <li key={type} className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          id={settingsFieldId(`orderTypes.${type}.enabled`)}
                          checked={entry.enabled}
                          onCheckedChange={(checked) =>
                            update({ ...draft, orderTypes: { ...draft.orderTypes, [type]: { ...entry, enabled: checked === true } } })
                          }
                        />
                        <Label htmlFor={settingsFieldId(`orderTypes.${type}.enabled`)}>Offer {label.toLowerCase()}</Label>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={prepId} className="text-xs">
                          Default prep time (minutes)<span className="sr-only"> for {label}</span>
                        </Label>
                        <Input
                          id={prepId}
                          inputMode="numeric"
                          value={entry.defaultPrepMinutes}
                          onChange={(event) =>
                            update({ ...draft, orderTypes: { ...draft.orderTypes, [type]: { ...entry, defaultPrepMinutes: event.target.value } } })
                          }
                          aria-invalid={errors[prepPath] ? true : undefined}
                          aria-describedby={errors[prepPath] ? `${prepId}-error` : undefined}
                          className="h-9 w-full bg-background tabular-nums sm:w-32"
                        />
                        <FieldError path={prepPath} errors={errors} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <FieldError path={orderSettingsPaths.orderTypes} errors={errors} />
            </fieldset>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              The Orders screen doesn&apos;t use these prep times yet; accepting an order still starts at 20 minutes.
            </p>
          </Section>

          <Section title="Minimum order" description="One amount for the whole restaurant, for every order type. Foodi checks it at checkout.">
            <div className="flex flex-col gap-2">
              <Label htmlFor={minimumId} className="gap-2">
                Minimum order ({currency})
                <span className="text-xs font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input
                id={minimumId}
                inputMode="decimal"
                placeholder="No minimum"
                value={draft.minimumOrder}
                onChange={(event) => update({ ...draft, minimumOrder: event.target.value })}
                aria-invalid={errors[orderSettingsPaths.minimumOrder] ? true : undefined}
                aria-describedby={["settings-minimum-help", errors[orderSettingsPaths.minimumOrder] ? `${minimumId}-error` : null].filter(Boolean).join(" ")}
                className="h-10 w-full bg-background tabular-nums sm:w-48"
              />
              <p id="settings-minimum-help" className="text-xs text-muted-foreground">
                Leave blank for no minimum.
              </p>
              <FieldError path={orderSettingsPaths.minimumOrder} errors={errors} />
            </div>
          </Section>

          <Section title="Pickup code">
            <div className="flex items-start gap-3">
              <Switch
                id="settings-pickup-code"
                checked={draft.pickupCodeRequired}
                onCheckedChange={(pickupCodeRequired) => update({ ...draft, pickupCodeRequired })}
                aria-describedby="settings-pickup-code-help"
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="settings-pickup-code">Require a pickup code</Label>
                <p id="settings-pickup-code-help" className="text-xs leading-relaxed text-muted-foreground">
                  Takeaway and dine-in customers give their code when they collect. Foodi checks it; the Orders screen
                  doesn&apos;t ask for it yet.
                </p>
              </div>
            </div>
          </Section>
        </div>

        <section aria-labelledby="saved-order-settings" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h2 id="saved-order-settings" className="text-base font-semibold">
            Saved settings
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">On</dt>
            <dd>{savedOn.length ? listOrderTypes(savedOn) : "None"}</dd>
            <dt className="text-muted-foreground">Off</dt>
            <dd>{savedOff.length ? listOrderTypes(savedOff) : "None"}</dd>
            <dt className="text-muted-foreground">Minimum</dt>
            <dd>{settings.minimumOrder ? formatMoney(settings.minimumOrder, locale) : "No minimum"}</dd>
            <dt className="text-muted-foreground">Pickup code</dt>
            <dd>{settings.pickupCodeRequired ? "Required" : "Not required"}</dd>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            These are your saved settings, not live availability. Whether customers can order right now also depends on
            your{" "}
            <Link href="/hours" className="font-medium text-primary underline-offset-4 hover:underline">
              hours and any pause
            </Link>
            , the menu and Foodi&apos;s own checks.
          </p>
        </section>
      </div>

      {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button ref={saveRef} type="submit" className="sm:min-w-36" aria-disabled={command.pending || undefined}>
          {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save order settings
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={(open) => {
          if (command.pending) return
          setConfirmOff(open)
          // The dialog has no trigger, so return focus to Save ourselves.
          if (!open) requestAnimationFrame(() => saveRef.current?.focus())
        }}
        title={`Turn off ${listOrderTypes(off).toLowerCase()}?`}
        description={
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>This saves {listOrderTypes(off).toLowerCase()} as off in your restaurant settings.</li>
            <li>
              Saving here doesn&apos;t by itself stop customers ordering at checkout. That check is Foodi&apos;s ordering
              service&apos;s job, and it isn&apos;t connected to these settings yet.
            </li>
            <li>
              Hours, special dates and menu settings for {listOrderTypes(off).toLowerCase()} stay as they are. Nothing is
              deleted or changed, so turning it back on later restores them.
            </li>
            <li>Orders already placed aren&apos;t changed.</li>
          </ul>
        }
        confirmLabel={`Turn off and save`}
        pending={command.pending}
        onConfirm={() => {
          save()
          setConfirmOff(false)
          requestAnimationFrame(() => saveRef.current?.focus())
        }}
      />
    </form>
  )
}
