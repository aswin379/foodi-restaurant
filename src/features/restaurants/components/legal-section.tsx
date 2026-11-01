"use client"

import { Input } from "@/components/ui/input"

import type { LegalInfo } from "../types"
import { Field, FormCard, ariaFor } from "./form-field"

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const DOCUMENT_ACCEPT = "application/pdf,image/png,image/jpeg"

export type LegalFiles = { idDocument: File | null; taxCertificate: File | null }
export type LegalErrors = Record<string, string>

export const emptyLegal: LegalInfo = { idDocumentType: "", idNumber: "", taxNumber: "", taxNumberExpiresOn: "" }

/** True when the owner typed any legal number, so the server rules (type + number together) apply. */
export function hasLegalInput(legal: LegalInfo): boolean {
  return Object.values(legal).some((value) => value.trim() !== "")
}

/** Everything here is optional; these checks only run on what was filled in. Mirrors the server rules. */
export function validateLegal(legal: LegalInfo, files: LegalFiles): LegalErrors {
  const e: LegalErrors = {}
  if (hasLegalInput(legal)) {
    if (!legal.idDocumentType.trim()) e["legal.idDocumentType"] = "Enter the ID document type."
    if (legal.idNumber.trim().length < 4) e["legal.idNumber"] = "Enter the ID number (at least 4 characters)."
    if (legal.taxNumber.trim() !== "" && legal.taxNumber.trim().length < 4) {
      e["legal.taxNumber"] = "Tax number must be at least 4 characters."
    }
    if (legal.taxNumberExpiresOn && legal.taxNumber.trim() === "") {
      e["legal.taxNumber"] = "Enter the tax number when an expiry date is given."
    }
    if (legal.taxNumberExpiresOn && legal.taxNumberExpiresOn < new Date().toISOString().slice(0, 10)) {
      e["legal.taxNumberExpiresOn"] = "Expiry date cannot be in the past."
    }
  }
  for (const [key, file] of [["idDocument", files.idDocument], ["taxCertificate", files.taxCertificate]] as const) {
    if (!file) continue
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) e[key] = "Use a PDF, JPG or PNG file."
    else if (file.size > MAX_DOCUMENT_BYTES) e[key] = "File must be 10 MB or smaller."
  }
  return e
}

/** Optional "Legal information" section: ID and tax details plus supporting documents. */
export function LegalSection({
  idPrefix,
  legal,
  onLegal,
  onFile,
  errors,
  existing,
}: {
  idPrefix: string
  legal: LegalInfo
  onLegal: (next: LegalInfo) => void
  onFile: (key: keyof LegalFiles, file: File | null) => void
  errors: LegalErrors
  /** Shown when documents were already uploaded; choosing a file replaces them. */
  existing?: { hasIdDocument: boolean; hasTaxCertificate: boolean }
}) {
  const set = (key: keyof LegalInfo) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onLegal({ ...legal, [key]: event.target.value })
  const err = (key: string) => errors[`legal.${key}`] ?? errors[key]

  return (
    <FormCard
      title="Legal information (optional)"
      description="Adding these now can speed up the review. Numbers are stored encrypted and never shown back in full."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlId={`${idPrefix}-idType`} label="ID document type" error={err("idDocumentType")}>
          <Input {...ariaFor(`${idPrefix}-idType`, err("idDocumentType"))} placeholder="e.g. Aadhaar, PAN" maxLength={40} value={legal.idDocumentType} onChange={set("idDocumentType")} />
        </Field>
        <Field htmlId={`${idPrefix}-idNumber`} label="ID number" error={err("idNumber")}>
          <Input {...ariaFor(`${idPrefix}-idNumber`, err("idNumber"))} autoComplete="off" maxLength={40} value={legal.idNumber} onChange={set("idNumber")} />
        </Field>
        <Field htmlId={`${idPrefix}-taxNumber`} label="Tax number" error={err("taxNumber")}>
          <Input {...ariaFor(`${idPrefix}-taxNumber`, err("taxNumber"))} autoComplete="off" maxLength={40} value={legal.taxNumber} onChange={set("taxNumber")} />
        </Field>
        <Field htmlId={`${idPrefix}-taxExpiry`} label="Tax certificate expiry" error={err("taxNumberExpiresOn")}>
          <Input {...ariaFor(`${idPrefix}-taxExpiry`, err("taxNumberExpiresOn"))} type="date" value={legal.taxNumberExpiresOn} onChange={set("taxNumberExpiresOn")} />
        </Field>
        <Field htmlId={`${idPrefix}-idDocument`} label={`ID document (PDF, JPG or PNG, max 10 MB)${existing?.hasIdDocument ? " · on file" : ""}`} error={errors["idDocument"]}>
          <Input {...ariaFor(`${idPrefix}-idDocument`, errors["idDocument"])} type="file" accept={DOCUMENT_ACCEPT} onChange={(e) => onFile("idDocument", e.target.files?.[0] ?? null)} />
        </Field>
        <Field htmlId={`${idPrefix}-taxCertificate`} label={`Tax certificate (PDF, JPG or PNG, max 10 MB)${existing?.hasTaxCertificate ? " · on file" : ""}`} error={errors["taxCertificate"]}>
          <Input {...ariaFor(`${idPrefix}-taxCertificate`, errors["taxCertificate"])} type="file" accept={DOCUMENT_ACCEPT} onChange={(e) => onFile("taxCertificate", e.target.files?.[0] ?? null)} />
        </Field>
      </div>
    </FormCard>
  )
}
