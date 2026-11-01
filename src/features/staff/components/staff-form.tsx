"use client"

import { useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api-client"

import { createStaff, updateStaff } from "../staff-service"
import type { StaffMember, StaffMeta } from "../types"
import {
  CUSTOM_DESIGNATION,
  fieldErrorsFrom,
  toCreateInput,
  toEditInput,
  validateStaff,
  type FieldErrors,
  type StaffFormValues,
} from "../validation"

type StaffFormProps = {
  meta: StaffMeta
  /** The member being edited; omit to register a new one. */
  staff?: StaffMember
  onSaved: (staff: StaffMember) => void
  onCancel: () => void
}

const inputClass = "h-11 rounded-xl bg-white px-3.5 shadow-none"

function initialValues(meta: StaffMeta, staff?: StaffMember): StaffFormValues {
  const operational = meta.restaurants.filter((r) => r.isOperational)
  return {
    name: staff?.name ?? "",
    email: staff?.email ?? "",
    mobile: staff?.mobile ?? "",
    password: "",
    // One restaurant is chosen for the owner; several must be picked.
    sellerId: staff ? String(staff.restaurant.id) : operational.length === 1 ? String(operational[0]?.id) : "",
    designation: staff ? String(staff.designation.id) : "",
    customDesignation: "",
    rolePreset: staff?.rolePreset ?? "custom",
    permissions: staff?.permissions ?? [],
  }
}

export function StaffForm({ meta, staff, onSaved, onCancel }: StaffFormProps) {
  const id = useId()
  const editing = staff !== undefined
  const operational = meta.restaurants.filter((r) => r.isOperational)
  const needsChoice = operational.length > 1
  const [values, setValues] = useState(() => initialValues(meta, staff))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Built-in titles plus this restaurant's own; editing keeps the member's restaurant.
  const restaurantId = values.sellerId ? Number(values.sellerId) : null
  const designations = meta.designations.filter((d) => !d.custom || d.sellerId === restaurantId)

  function set<K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function applyPreset(key: string) {
    const preset = meta.rolePresets.find((p) => p.key === key)
    setValues((current) => ({
      ...current,
      rolePreset: key,
      // A preset only pre-fills the boxes; "custom" leaves the current choice alone.
      permissions: preset && preset.key !== "custom" ? [...preset.permissions] : current.permissions,
    }))
  }

  function togglePermission(key: string, checked: boolean) {
    setValues((current) => {
      // One checkbox per module: it grants every action the module offers.
      const next = new Set(current.permissions)
      if (checked) next.add(key)
      else next.delete(key)
      return { ...current, rolePreset: "custom", permissions: [...next] }
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const found = validateStaff(values, editing ? "edit" : "create", needsChoice)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

    setPending(true)
    try {
      const saved = staff
        ? await updateStaff(staff.id, toEditInput(values))
        : await createStaff(toCreateInput(values))
      onSaved(saved)
    } catch (error) {
      const serverErrors = error instanceof ApiError ? fieldErrorsFrom(error.details) : {}
      setErrors(serverErrors)
      setFormError(
        Object.keys(serverErrors).length > 0
          ? "Please fix the highlighted fields."
          : error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."
      )
      setPending(false)
    }
  }

  function field(key: keyof StaffFormValues, label: string, children: (props: { id: string; invalid: boolean; describedBy?: string }) => React.ReactNode, hint?: string) {
    const fieldId = `${id}-${key}`
    const errorId = `${fieldId}-error`
    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId}>{label}</Label>
        {children({ id: fieldId, invalid: Boolean(errors[key]), describedBy: errors[key] ? errorId : undefined })}
        {hint && !errors[key] ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {errors[key] ? (
          <p id={errorId} className="flex items-center gap-1.5 text-sm text-danger-foreground">
            <AlertCircle aria-hidden className="size-3.5 shrink-0" />
            {errors[key]}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="space-y-7">
      {formError ? (
        <div role="alert" className="flex gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{formError}</p>
        </div>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold">Personal information</legend>
        {field("name", "Full name", (p) => (
          <Input id={p.id} autoComplete="off" maxLength={100} value={values.name} onChange={(e) => set("name", e.target.value)} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass} />
        ))}
        {field(
          "email",
          "Email (used to sign in)",
          (p) => (
            <Input id={p.id} type="email" autoComplete="off" maxLength={190} value={values.email} readOnly={editing} disabled={editing} onChange={(e) => set("email", e.target.value)} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass} />
          ),
          editing ? "The sign-in email cannot be changed." : undefined
        )}
        {field("mobile", "Mobile number (optional)", (p) => (
          <Input id={p.id} type="tel" inputMode="tel" autoComplete="off" value={values.mobile} onChange={(e) => set("mobile", e.target.value)} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass} />
        ))}
        {editing
          ? null
          : field(
              "password",
              "Temporary password",
              (p) => (
                <Input id={p.id} type="password" autoComplete="new-password" maxLength={128} value={values.password} onChange={(e) => set("password", e.target.value)} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass} />
              ),
              "They must choose their own password the first time they sign in."
            )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold">Assignment</legend>
        {field("sellerId", "Restaurant", (p) =>
          editing || !needsChoice ? (
            // Single restaurant, or editing: shown for clarity, not selectable.
            <Input id={p.id} readOnly disabled value={staff?.restaurant.name ?? operational[0]?.name ?? ""} className={inputClass} />
          ) : (
            <Select value={values.sellerId} onValueChange={(v) => set("sellerId", v)}>
              <SelectTrigger id={p.id} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className="h-11 w-full rounded-xl bg-white">
                <SelectValue placeholder="Select a restaurant" />
              </SelectTrigger>
              <SelectContent>
                {operational.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        )}
        {field(
          "designation",
          "Designation",
          (p) => (
            <Select value={values.designation} onValueChange={(v) => set("designation", v)}>
              <SelectTrigger id={p.id} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className="h-11 w-full rounded-xl bg-white">
                <SelectValue placeholder="Select a designation" />
              </SelectTrigger>
              <SelectContent>
                {designations.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_DESIGNATION}>Custom designation…</SelectItem>
              </SelectContent>
            </Select>
          ),
          "A job title only. It does not give access to anything."
        )}
        {values.designation === CUSTOM_DESIGNATION
          ? field("customDesignation", "Custom designation", (p) => (
              <Input id={p.id} maxLength={60} value={values.customDesignation} onChange={(e) => set("customDesignation", e.target.value)} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass} />
            ))
          : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold">Access</legend>
        {field(
          "rolePreset",
          "Role preset",
          (p) => (
            <Select value={values.rolePreset} onValueChange={applyPreset}>
              <SelectTrigger id={p.id} className="h-11 w-full rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.rolePresets.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
          "Fills in the permissions below. You can adjust them afterwards."
        )}
        <div className="space-y-4 rounded-2xl border p-4">
          {meta.permissionGroups.map((group) => (
            <div key={group.key} role="group" aria-labelledby={`${id}-${group.key}`} className="space-y-2">
              <p id={`${id}-${group.key}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              {group.permissions.map((permission) => {
                const boxId = `${id}-perm-${permission.key}`
                return (
                  <div key={permission.key} className="flex items-center gap-2.5">
                    <Checkbox
                      id={boxId}
                      checked={values.permissions.includes(permission.key)}
                      onCheckedChange={(checked) => togglePermission(permission.key, checked === true)}
                    />
                    <Label htmlFor={boxId} className="font-normal">
                      {permission.label}
                    </Label>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Saving…
            </>
          ) : editing ? (
            "Save changes"
          ) : (
            "Add staff member"
          )}
        </Button>
      </div>
    </form>
  )
}
