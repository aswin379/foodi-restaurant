"use client"

import { useRef, useState } from "react"
import { AlertCircle, Loader2, MapPin } from "lucide-react"

import { ImagePicker } from "@/components/menu/image-picker"
import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { RestaurantProfile } from "@/lib/settings/types"
import {
  COVER_MAX_BYTES,
  DESCRIPTION_MAX,
  hasErrors,
  LOGO_MAX_BYTES,
  NAME_MAX,
  profileDraftFrom,
  settingsFieldId,
  validateProfileDraft,
  type FieldErrors,
  type ProfileDraft,
} from "@/lib/settings/validation"

import { useSettingsCommand } from "./use-settings-command"

// Field paths in the order they appear, for the error summary.
const ORDER = [
  "name",
  "description",
  "phone",
  "email",
  "address.line1",
  "address.line2",
  "address.city",
  "address.region",
  "address.postalCode",
  "location.latitude",
  "location.longitude",
  "logo",
  "cover",
]

// Draft keys for the address and location paths.
const DRAFT_KEY: Record<string, keyof ProfileDraft> = {
  "address.line1": "line1",
  "address.line2": "line2",
  "address.city": "city",
  "address.region": "region",
  "address.postalCode": "postalCode",
  "location.latitude": "latitude",
  "location.longitude": "longitude",
}

/** The control an error-summary link focuses: for images, the visible "Choose …" button, not the hidden file input. */
export const summaryTarget = (path: string) =>
  path === "logo" || path === "cover" ? `${settingsFieldId(path)}-button` : settingsFieldId(path)

/**
 * The restaurant profile (PRD §6 Settings, B4a). Validated here and again on
 * the server; saves carry the loaded version, so a stale save is refused. In
 * preview mode the save is simulated and labelled. Time zone, currency and
 * language are read-only (D7).
 */
export function ProfileForm({ profile }: { profile: RestaurantProfile }) {
  const command = useSettingsCommand()
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraftFrom(profile))
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const [attempted, setAttempted] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const errors: FieldErrors = { ...command.fieldErrors, ...localErrors }

  function update(patch: Partial<ProfileDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (attempted) setLocalErrors(validateProfileDraft(next))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    const next = validateProfileDraft(draft)
    setLocalErrors(next)
    if (hasErrors(next)) {
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    command.run({ type: "save_profile", version: profile.version, draft }, "Restaurant profile updated")
  }

  const entries = attempted ? ORDER.filter((path) => errors[path]).map((path) => [path, errors[path]] as const) : []
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

  const field = (path: string, label: string, options: { required?: boolean; type?: string; inputMode?: "decimal" | "tel" | "email"; autoComplete?: string } = {}) => {
    const key = DRAFT_KEY[path] ?? (path as keyof ProfileDraft)
    const id = settingsFieldId(path)
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <FieldLabel htmlFor={id} required={options.required}>
          {label}
        </FieldLabel>
        <Input
          id={id}
          type={options.type ?? "text"}
          inputMode={options.inputMode}
          autoComplete={options.autoComplete}
          value={draft[key] as string}
          onChange={(event) => update({ [key]: event.target.value })}
          aria-required={options.required || undefined}
          aria-invalid={errors[path] ? true : undefined}
          aria-describedby={errors[path] ? `${id}-error` : undefined}
          className="h-10 bg-background"
        />
        <FieldError path={path} errors={errors} />
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {entries.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="profile-errors-title"
          className="rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p id="profile-errors-title" className="font-semibold text-danger-foreground">
            Fix {entries.length === 1 ? "this problem" : `these ${entries.length} problems`} before saving
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-danger-foreground">
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
          <Section title="About the restaurant">
            {field("name", "Restaurant name", { required: true, autoComplete: "organization" })}
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor={settingsFieldId("description")}>Description</FieldLabel>
              <Textarea
                id={settingsFieldId("description")}
                value={draft.description}
                onChange={(event) => update({ description: event.target.value })}
                rows={3}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={["settings-description-count", errors.description ? `${settingsFieldId("description")}-error` : null].filter(Boolean).join(" ")}
                className="bg-background"
              />
              <p id="settings-description-count" className="text-xs text-muted-foreground">
                {draft.description.trim().length} of {DESCRIPTION_MAX} characters. Name up to {NAME_MAX}.
              </p>
              <FieldError path="description" errors={errors} />
            </div>
          </Section>

          <Section title="Contact" description="How Foodi and customers can reach the restaurant.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("phone", "Phone", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
              {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email" })}
            </div>
          </Section>

          <Section title="Address and location">
            {field("address.line1", "Address", { required: true, autoComplete: "address-line1" })}
            {field("address.line2", "Address line 2", { autoComplete: "address-line2" })}
            <div className="grid gap-4 sm:grid-cols-3">
              {field("address.city", "City", { required: true, autoComplete: "address-level2" })}
              {field("address.region", "State or region", { autoComplete: "address-level1" })}
              {field("address.postalCode", "Postal code", { required: true, autoComplete: "postal-code" })}
            </div>
            <fieldset className="flex flex-col gap-3" aria-describedby="settings-location-help">
              <legend className="text-sm font-medium">Map location</legend>
              <p id="settings-location-help" className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin aria-hidden className="mt-px size-3.5 shrink-0" />
                There&apos;s no map here yet. Enter the coordinates from a map app, or leave both blank.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("location.latitude", "Latitude", { inputMode: "decimal" })}
                {field("location.longitude", "Longitude", { inputMode: "decimal" })}
              </div>
            </fieldset>
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Logo" optional>
            <ImagePicker
              id={settingsFieldId("logo")}
              alt="Restaurant logo"
              label="logo image"
              maxBytes={LOGO_MAX_BYTES}
              currentUrl={profile.logoUrl}
              value={draft.logo}
              onChange={(logo) => update({ logo })}
              error={errors.logo}
              help="JPG, PNG or WebP, up to 2 MB. It's cropped to a square from the centre and compressed to 300 KB or less."
            />
          </Section>
          <Section title="Cover image" optional>
            <ImagePicker
              id={settingsFieldId("cover")}
              alt="Restaurant cover image"
              label="cover image"
              maxBytes={COVER_MAX_BYTES}
              shape="original"
              currentUrl={profile.coverUrl}
              value={draft.cover}
              onChange={(cover) => update({ cover })}
              error={errors.cover}
              help="JPG, PNG or WebP, up to 2 MB. It keeps its shape, is scaled down if it's wider than 1600 px, and is compressed to 400 KB or less."
            />
          </Section>
          <Section title="Region and currency" description="Set by Foodi. Contact support to change them.">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-background/70 p-4 text-sm ring-1 ring-border-soft">
              <dt className="text-muted-foreground">Time zone</dt>
              <dd className="font-medium">{profile.timeZone}</dd>
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">{profile.currency}</dd>
              <dt className="text-muted-foreground">Language</dt>
              <dd className="font-medium">{profile.locale}</dd>
            </dl>
          </Section>
        </div>
      </div>

      {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

      <div className="flex flex-col-reverse gap-2 rounded-3xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" className="sm:min-w-36" aria-disabled={command.pending || undefined}>
          {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save profile
        </Button>
      </div>
    </form>
  )
}

export function FieldError({ path, errors }: { path: string; errors: FieldErrors }) {
  const message = errors[path]
  return message ? (
    <p id={`${settingsFieldId(path)}-error`} className="flex items-center gap-1.5 text-sm text-danger-foreground">
      <AlertCircle aria-hidden className="size-3.5 shrink-0" />
      {message}
    </p>
  ) : null
}

function FieldLabel({ htmlFor, required = false, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="gap-2">
      {children}
      {required ? (
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary-text">Required</span>
      ) : (
        <span className="text-xs font-normal text-muted-foreground">Optional</span>
      )}
    </Label>
  )
}

export function Section({
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
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {title}
          {optional ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
