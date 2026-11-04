"use client"

import { useId, useState } from "react"
import { CircleAlert, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { selectClass } from "@/features/profile/components/section-form"

import { squareCrop } from "../square-crop"
import {
  DELIVERY_TYPES,
  IDENTITY_TYPES,
  type DeliveryBoy,
  type DeliveryLookups,
  type DeliveryManType,
  type IdentityType,
} from "../types"
import {
  MAX_EXTRA_FILES,
  MAX_IDENTITY_FILES,
  PASSWORD_HINT,
  validateRider,
  type RiderErrors,
  type RiderFiles,
  type RiderValues,
} from "../validation"

function Field({ label, error, children, htmlFor }: { label: string; error?: string | undefined; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The delivery boy form. Same fields and rules as the admin form. The zone is the restaurant's own and is
 * shown read-only. Create sends the photo and documents; edit sends fields only (files have their own panel).
 * `onSubmit` throws an Error whose message is shown above the button.
 */
export function RiderForm({
  lookups,
  rider,
  submitLabel,
  onSubmit,
}: {
  lookups: DeliveryLookups
  rider?: DeliveryBoy
  submitLabel: string
  onSubmit: (values: RiderValues, files: RiderFiles) => Promise<void>
}) {
  const id = useId()
  const mode = rider ? "edit" : "create"
  const [values, setValues] = useState<RiderValues>({
    firstName: rider?.firstName ?? "",
    lastName: rider?.lastName ?? "",
    email: rider?.email ?? "",
    phone: rider?.phoneNumber ?? "",
    password: "",
    identityType: rider?.identityDocumentType ?? "national_id",
    identityNumber: rider?.identityDocumentNumber ?? "",
    vehicleId: rider ? String(rider.vehicle.id) : "",
    type: rider?.deliveryManType ?? "freelance",
  })
  const [files, setFiles] = useState<RiderFiles>({ photo: null, identity: [], extra: [] })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<RiderErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const set = <K extends keyof RiderValues>(key: K, value: RiderValues[K]) => setValues((c) => ({ ...c, [key]: value }))

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    try {
      const cropped = await squareCrop(file)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoPreview(URL.createObjectURL(cropped))
      setFiles((c) => ({ ...c, photo: cropped }))
      setErrors((c) => ({ ...c, photo: undefined }))
    } catch (e) {
      setErrors((c) => ({ ...c, photo: e instanceof Error ? e.message : "This image could not be read." }))
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setServerError(null)
    const next = validateRider(values, files, mode)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setPending(true)
    try {
      await onSubmit(values, files)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Could not save the delivery boy.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={pending} className="flex flex-col gap-4">
      {serverError ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {serverError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor={`${id}-first`} error={errors.firstName}>
          <Input id={`${id}-first`} value={values.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor={`${id}-last`}>
          <Input id={`${id}-last`} value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`} error={errors.email}>
          <Input id={`${id}-email`} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor={`${id}-phone`} error={errors.phone}>
          <Input id={`${id}-phone`} inputMode="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={mode === "edit" ? "New password (optional)" : "Password"} htmlFor={`${id}-password`} error={errors.password}>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
        </Field>
        <Field label="Delivery type" htmlFor={`${id}-type`}>
          <select id={`${id}-type`} value={values.type} onChange={(e) => set("type", e.target.value as DeliveryManType)} className={selectClass}>
            {DELIVERY_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zone" htmlFor={`${id}-zone`}>
          <Input id={`${id}-zone`} value={lookups.zone?.name ?? "No zone yet"} readOnly disabled />
        </Field>
        <Field label="Vehicle" htmlFor={`${id}-vehicle`} error={errors.vehicleId}>
          <select id={`${id}-vehicle`} value={values.vehicleId} onChange={(e) => set("vehicleId", e.target.value)} className={selectClass}>
            <option value="">Choose…</option>
            {lookups.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Identity type" htmlFor={`${id}-idtype`}>
          <select
            id={`${id}-idtype`}
            value={values.identityType}
            onChange={(e) => set("identityType", e.target.value as IdentityType)}
            className={selectClass}
          >
            {IDENTITY_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Identity number" htmlFor={`${id}-idnumber`} error={errors.identityNumber}>
          <Input id={`${id}-idnumber`} value={values.identityNumber} onChange={(e) => set("identityNumber", e.target.value)} />
        </Field>
      </div>

      {mode === "create" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Profile photo (required, cropped to a square)" htmlFor={`${id}-photo`} error={errors.photo}>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={photoPreview} alt="Profile photo preview" className="size-16 rounded-lg border object-cover" />
              ) : null}
              <input
                id={`${id}-photo`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
                className="text-sm"
              />
            </div>
          </Field>
          <Field label={`Identity images (up to ${MAX_IDENTITY_FILES}, JPG/PNG/PDF, 2 MB each)`} htmlFor={`${id}-identity`} error={errors.identity}>
            <input
              id={`${id}-identity`}
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFiles((c) => ({ ...c, identity: Array.from(e.target.files ?? []) }))}
              className="text-sm"
            />
          </Field>
          <Field label={`Additional documents (up to ${MAX_EXTRA_FILES}, JPG/PNG/PDF, 2 MB each)`} htmlFor={`${id}-extra`} error={errors.extra}>
            <input
              id={`${id}-extra`}
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFiles((c) => ({ ...c, extra: Array.from(e.target.files ?? []) }))}
              className="text-sm"
            />
          </Field>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || lookups.zone === null}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Builds the multipart body the API expects (zone is added by the server from the restaurant). */
export function toCreateForm(values: RiderValues, files: RiderFiles): FormData {
  const form = new FormData()
  form.set("first_name", values.firstName.trim())
  if (values.lastName.trim()) form.set("last_name", values.lastName.trim())
  form.set("email", values.email.trim())
  form.set("phone_number", values.phone.trim())
  form.set("password", values.password)
  form.set("identity_document_type", values.identityType)
  form.set("identity_document_number", values.identityNumber.trim())
  form.set("vehicle_id", values.vehicleId)
  form.set("delivery_man_type", values.type)
  if (files.photo) form.set("profile_photo", files.photo)
  files.identity.forEach((file) => form.append("identity_documents", file))
  files.extra.forEach((file) => form.append("additional_documents", file))
  return form
}

/** Only the fields that can change on edit; the password is sent only when typed. */
export function toUpdateFields(values: RiderValues): Record<string, string> {
  const fields: Record<string, string> = {
    first_name: values.firstName.trim(),
    email: values.email.trim(),
    phone_number: values.phone.trim(),
    identity_document_type: values.identityType,
    identity_document_number: values.identityNumber.trim(),
    vehicle_id: values.vehicleId,
    delivery_man_type: values.type,
  }
  if (values.lastName.trim()) fields.last_name = values.lastName.trim()
  if (values.password) fields.password = values.password
  return fields
}
