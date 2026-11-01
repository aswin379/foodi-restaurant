"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Percent } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError } from "@/lib/api-client"

import { useRestaurants } from "../restaurant-context"
import {
  addRestaurant,
  getApplicationOptions,
  resubmitRestaurant,
  saveSection,
  uploadFile,
} from "../restaurant-service"
import type { ApplicationOptions, LegalInfo, Restaurant, RestaurantDetail } from "../types"
import { OTHER_ZONE, zoneMismatch, type ZoneCheck } from "../zone-rules"
import { Field, FormCard, ariaFor } from "./form-field"
import { FormStepper } from "./form-stepper"
import { ImagePicker, imageProblem } from "./image-picker"
import { LocationSection, type LocationValues } from "./location-section"
import {
  LegalSection,
  emptyLegal,
  hasLegalInput,
  validateLegal,
  type LegalFiles,
} from "./legal-section"
import { RestaurantStatusBadge } from "./restaurant-status-badge"

// Same steps as the admin "Add seller" form.
const STEPS = ["General Information", "Business Plan", "Complete"] as const

type Errors = Record<string, string>

/** The optional legal part of the request body; empty strings are left out. */
function legalPayload(legal: LegalInfo) {
  if (!hasLegalInput(legal)) return undefined
  return {
    idDocumentType: legal.idDocumentType.trim(),
    idNumber: legal.idNumber.trim(),
    ...(legal.taxNumber.trim() ? { taxNumber: legal.taxNumber.trim() } : {}),
    ...(legal.taxNumberExpiresOn ? { taxNumberExpiresOn: legal.taxNumberExpiresOn } : {}),
  }
}

function serverErrors(error: unknown): Errors {
  const found: Errors = {}
  if (error instanceof ApiError && Array.isArray(error.details)) {
    for (const d of error.details as Array<{ path?: string; message?: string }>) {
      if (d.path && d.message) found[d.path] = d.message
    }
  }
  return found
}

/**
 * Restaurant application form for a signed-in owner. Only restaurant details are collected: the owner is the
 * account, and the restaurant is sent for admin review (never approved here).
 *
 * With `existing` (an application with requested changes) the same form corrects the application: each section
 * is saved through the same server rules, then the application is resubmitted for review.
 */
export function AddRestaurantForm({
  existing,
  onResubmitted,
}: {
  existing?: RestaurantDetail
  onResubmitted?: (restaurant: RestaurantDetail) => void
}) {
  const id = useId()
  const editing = existing !== undefined
  const { reload } = useRestaurants()
  const [options, setOptions] = useState<ApplicationOptions | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [name, setName] = useState(existing?.name ?? "")
  const [sellerTypeId, setSellerTypeId] = useState(existing ? String(existing.sellerTypeId) : "")
  const [cuisineIds, setCuisineIds] = useState<number[]>(existing?.cuisineIds ?? [])
  const [location, setLocation] = useState<LocationValues>({
    // A pending zone request is shown as "Other" so it can be kept or changed.
    zoneId: existing?.requestedZoneName ? OTHER_ZONE : "",
    requestedZoneName: existing?.requestedZoneName ?? "",
    address: existing?.address ?? "",
    latitude: existing?.latitude != null ? String(existing.latitude) : "",
    longitude: existing?.longitude != null ? String(existing.longitude) : "",
  })
  const [zoneCheck, setZoneCheck] = useState<ZoneCheck>(null)
  const { zoneId, requestedZoneName, address, latitude, longitude } = location
  const [prepTimeUnit, setPrepTimeUnit] = useState<"min" | "hours">("min")
  const [prepTimeMin, setPrepTimeMin] = useState("")
  const [prepTimeMax, setPrepTimeMax] = useState("")
  const [logo, setLogo] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [legal, setLegal] = useState<LegalInfo>(emptyLegal)
  const [legalFiles, setLegalFiles] = useState<LegalFiles>({ idDocument: null, taxCertificate: null })

  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<Restaurant | null>(null)

  useEffect(() => {
    getApplicationOptions().then(setOptions).catch(() => setLoadError(true))
  }, [])

  function validate(): Errors {
    const e: Errors = {}
    const lat = Number(latitude)
    const lng = Number(longitude)
    const min = Number(prepTimeMin)
    const max = Number(prepTimeMax)
    if (!name.trim()) e.name = "Enter the restaurant name."
    if (!sellerTypeId) e.sellerTypeId = "Select a business type."
    // Editing: the pin decides the zone, so choosing one is optional.
    if (!editing && !zoneId) e.zoneId = "Select a zone."
    if (zoneId === OTHER_ZONE && requestedZoneName.trim().length < 2) e.requestedZoneName = "Enter the name of the zone you need."
    if (!address.trim()) e.address = "Enter the address."
    if (latitude === "" || !Number.isFinite(lat) || lat < -90 || lat > 90) e.latitude = "Enter a latitude between -90 and 90."
    if (longitude === "" || !Number.isFinite(lng) || lng < -180 || lng > 180) e.longitude = "Enter a longitude between -180 and 180."
    // Only a mismatch the server already reported blocks here; the server re-checks on submit.
    const mismatch = zoneMismatch(zoneId, zoneCheck)
    if (mismatch && !e.latitude && !e.longitude) e.latitude = mismatch
    if (!editing) {
      if (!Number.isInteger(min) || min < 1) e.prepTimeMin = "Enter the minimum preparation time."
      else if (prepTimeUnit === "min" && min < 10) e.prepTimeMin = "Minimum must be at least 10 minutes."
      if (!Number.isInteger(max) || max <= min) e.prepTimeMax = "Maximum must be greater than the minimum."
    }
    for (const [key, file, label] of [["logo", logo, "your restaurant logo"], ["cover", cover, "a cover photo"]] as const) {
      if (!file) {
        if (!editing) e[key] = `Add ${label}.`
      } else {
        const problem = imageProblem(file)
        if (problem) e[key] = problem
      }
    }
    return { ...e, ...validateLegal(legal, legalFiles) }
  }

  /** An existing zone or a requested new one, never both. Empty while editing: the pin decides. */
  function zonePayload(): { zoneId?: number; requestedZoneName?: string } {
    if (zoneId === OTHER_ZONE) return { requestedZoneName: requestedZoneName.trim() }
    return zoneId ? { zoneId: Number(zoneId) } : {}
  }

  async function submitNew(): Promise<void> {
    if (!logo || !cover) return
    const restaurant = await addRestaurant(
      {
        sellerTypeId: Number(sellerTypeId),
        name: name.trim(),
        cuisineIds,
        address: address.trim(),
        ...zonePayload(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        prepTimeUnit,
        prepTimeMin: Number(prepTimeMin),
        prepTimeMax: Number(prepTimeMax),
        legal: legalPayload(legal),
      },
      { logo, cover, idDocument: legalFiles.idDocument, taxCertificate: legalFiles.taxCertificate }
    )
    await reload()
    setCreated(restaurant)
  }

  /** Saves each section, uploads changed files, then resubmits. Stops at the first failure; saved parts are kept. */
  async function submitCorrections(application: RestaurantDetail): Promise<void> {
    await saveSection(application.id, "business", {
      sellerTypeId: Number(sellerTypeId),
      name: name.trim(),
      ...(application.description ? { description: application.description } : {}),
      cuisineIds,
      // The business step replaces tags, so the existing ones are sent back unchanged.
      tags: application.tags,
    })
    await saveSection(application.id, "address", {
      address: address.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      ...zonePayload(),
    })
    const documents = legalPayload(legal)
    if (documents) await saveSection(application.id, "documents", documents)
    if (logo) await uploadFile(application.id, "logo", logo)
    if (cover) await uploadFile(application.id, "cover", cover)
    if (legalFiles.idDocument) await uploadFile(application.id, "id_document", legalFiles.idDocument)
    if (legalFiles.taxCertificate) await uploadFile(application.id, "tax_certificate", legalFiles.taxCertificate)
    const updated = await resubmitRestaurant(application.id)
    await reload()
    onResubmitted?.(updated)
  }

  function goTo(next: number) {
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  /** Step 1 "Next": show every problem and focus the first one, or move on. */
  function handleNext(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    setFormError(null)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus()
      return
    }
    goTo(1)
  }

  async function handleSubmit() {
    if (pending) return
    const found = validate()
    if (Object.keys(found).length > 0) {
      setErrors(found)
      goTo(0)
      return
    }
    setFormError(null)
    setPending(true)
    try {
      if (existing) await submitCorrections(existing)
      else await submitNew()
    } catch (error) {
      const fromServer = serverErrors(error)
      setErrors(fromServer)
      if (Object.keys(fromServer).length > 0) goTo(0)
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  if (created) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6">
        <CheckCircle2 aria-hidden className="size-8 text-success-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Application submitted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {created.name} was sent for review. You can manage it once it is approved.
          </p>
        </div>
        <RestaurantStatusBadge status={created.status} />
        <Button asChild>
          <Link href="/restaurants">Back to my restaurants</Link>
        </Button>
      </div>
    )
  }

  if (loadError) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
        <AlertCircle aria-hidden className="size-4" /> We couldn&apos;t load the form options. Please try again later.
      </p>
    )
  }
  if (!options) {
    return (
      <div role="status" className="grid min-h-40 place-items-center text-muted-foreground">
        <Loader2 aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  const key = (name: string) => `${id}-${name}`

  const zoneName =
    zoneId === OTHER_ZONE
      ? `${requestedZoneName} (new zone requested)`
      : (options.zones.find((z) => String(z.id) === zoneId)?.name ?? existing?.zoneName ?? zoneCheckName(zoneCheck))
  const summary: [string, string | undefined][] = [
    ["Restaurant", name],
    ["Business type", options.sellerTypes.find((t) => String(t.id) === sellerTypeId)?.name],
    ["Cuisine", options.cuisines.filter((c) => cuisineIds.includes(c.id)).map((c) => c.name).join(", ")],
    ["Zone", zoneName],
    ["Address", address],
    [
      "Preparation time",
      editing
        ? existing?.prepTime.min != null
          ? `${existing.prepTime.min} to ${existing.prepTime.max} ${existing.prepTime.unit === "hours" ? "hours" : "minutes"}`
          : undefined
        : `${prepTimeMin} to ${prepTimeMax} ${prepTimeUnit === "min" ? "minutes" : "hours"}`,
    ],
    ["Business plan", "Commission base (0%)"],
  ]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <FormStepper steps={STEPS} step={step} />

      {step === 0 ? (
        <form onSubmit={handleNext} noValidate className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            {editing
              ? "Update the details the review team asked about, then resubmit. The application is reviewed again before you can use it."
              : "Your owner details are already on file. Enter only the new restaurant's details; it will be reviewed before you can use it."}
          </p>

          <FormCard title="Restaurant info">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field htmlId={key("name")} label="Restaurant name" error={errors["name"]} required>
                  <Input {...ariaFor(key("name"), errors["name"])} placeholder="Ex: ABC Kitchen" value={name} onChange={(e) => setName(e.target.value)} maxLength={191} />
                </Field>
              </div>
              <Field htmlId={key("sellerTypeId")} label="Business type" error={errors["sellerTypeId"]} required>
                <Select value={sellerTypeId} onValueChange={setSellerTypeId}>
                  <SelectTrigger {...ariaFor(key("sellerTypeId"), errors["sellerTypeId"])}>
                    <SelectValue placeholder="Select a business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.sellerTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {options.cuisines.length > 0 ? (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <p className="text-sm leading-none font-medium">Cuisine</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Cuisine">
                    {options.cuisines.map((c) => {
                      const on = cuisineIds.includes(c.id)
                      return (
                        <Button
                          key={c.id}
                          type="button"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          aria-pressed={on}
                          onClick={() => setCuisineIds((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                        >
                          {c.name}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <ImagePicker
                  htmlId={key("logo")}
                  label={editing ? "Replace logo" : "Logo"}
                  hint="JPG, PNG or WebP, up to 2 MB. Shown at 3:2."
                  file={logo}
                  error={errors["logo"]}
                  required={!editing}
                  currentUrl={existing?.logoUrl}
                  onChange={setLogo}
                />
                <ImagePicker
                  htmlId={key("cover")}
                  label={editing ? "Replace cover photo" : "Cover photo"}
                  hint="JPG, PNG or WebP, up to 2 MB. Shown at 3:1."
                  file={cover}
                  error={errors["cover"]}
                  required={!editing}
                  currentUrl={existing?.coverUrl}
                  onChange={setCover}
                />
              </div>
            </div>
          </FormCard>

          <FormCard title="Location and timing" description="Search for the place or drop the pin; the zone is detected from it.">
            <LocationSection
              idPrefix={id}
              zones={options.zones}
              values={location}
              onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
              zoneCheck={zoneCheck}
              onZoneCheck={setZoneCheck}
              errors={errors}
              zoneLabel={editing ? "Zone (optional, follows the location)" : "Zone"}
              zoneRequired={!editing}
              zonePlaceholder={editing ? (existing?.zoneName ?? "Select a zone") : "Select a zone"}
            />
            {editing ? (
              <p className="text-sm text-muted-foreground">
                Preparation time: {existing?.prepTime.min ?? "–"}–{existing?.prepTime.max ?? "–"}{" "}
                {existing?.prepTime.unit === "hours" ? "hours" : "minutes"}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlId={key("prepTimeMin")} label="Minimum preparation time" error={errors["prepTimeMin"]} required>
                  <Input {...ariaFor(key("prepTimeMin"), errors["prepTimeMin"])} inputMode="numeric" value={prepTimeMin} onChange={(e) => setPrepTimeMin(e.target.value)} />
                </Field>
                <Field htmlId={key("prepTimeMax")} label="Maximum preparation time" error={errors["prepTimeMax"]} required>
                  <Input {...ariaFor(key("prepTimeMax"), errors["prepTimeMax"])} inputMode="numeric" value={prepTimeMax} onChange={(e) => setPrepTimeMax(e.target.value)} />
                </Field>
                <Field htmlId={key("prepTimeUnit")} label="Time unit" error={errors["prepTimeUnit"]} required>
                  <Select value={prepTimeUnit} onValueChange={(v) => setPrepTimeUnit(v as "min" | "hours")}>
                    <SelectTrigger {...ariaFor(key("prepTimeUnit"), errors["prepTimeUnit"])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="min">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </FormCard>

          <LegalSection
            idPrefix={id}
            legal={legal}
            onLegal={setLegal}
            onFile={(fileKey, file) => setLegalFiles((prev) => ({ ...prev, [fileKey]: file }))}
            errors={errors}
            existing={existing?.documents}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/restaurants">Cancel</Link>
            </Button>
            <Button type="submit" className="h-11 px-6">
              Next <ArrowRight aria-hidden />
            </Button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <FormCard title="Business plan" description="Choose how you work with Foodi.">
          <button
            type="button"
            aria-pressed
            className="flex w-full items-start gap-4 rounded-xl border-2 border-primary bg-primary/5 p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Percent aria-hidden className="size-6" />
            </span>
            <span className="flex-1 space-y-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">Commission base</span>
                <Check aria-hidden className="size-5 text-primary" />
              </span>
              <span className="block text-3xl font-extrabold text-primary">0% commission</span>
              <span className="block text-sm text-muted-foreground">
                List your menu at your own prices. Foodi takes no commission cut from your orders.
              </span>
            </span>
          </button>
          <div className="flex justify-between gap-3">
            <Button variant="outline" className="h-11 px-5" onClick={() => goTo(0)}>
              <ArrowLeft aria-hidden /> Back
            </Button>
            <Button className="h-11 px-6" onClick={() => goTo(2)}>
              Next <ArrowRight aria-hidden />
            </Button>
          </div>
        </FormCard>
      ) : null}

      {step === 2 ? (
        <FormCard title="Review and submit" description="Check the details. You can go back to change anything.">
          <dl className="divide-y rounded-lg border">
            {summary.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium break-words">{value || "–"}</dd>
              </div>
            ))}
          </dl>
          {formError ? (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-foreground">
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {formError}
            </p>
          ) : null}
          <div className="flex justify-between gap-3">
            <Button variant="outline" className="h-11 px-5" disabled={pending} onClick={() => goTo(1)}>
              <ArrowLeft aria-hidden /> Back
            </Button>
            <Button className="h-11 px-6" disabled={pending} onClick={() => void handleSubmit()}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {editing ? "Save and resubmit" : "Submit application"}
            </Button>
          </div>
        </FormCard>
      ) : null}
    </div>
  )
}

function zoneCheckName(check: ZoneCheck): string | undefined {
  return check && check !== "outside" ? check.name : undefined
}
