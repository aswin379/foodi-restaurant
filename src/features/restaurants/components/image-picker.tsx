"use client"

import { useEffect, useMemo } from "react"
import { ImagePlus } from "lucide-react"

import { cn } from "@/lib/utils"

import { Field } from "./form-field"

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/** Error for a chosen logo/cover file, or undefined when it is acceptable. */
export function imageProblem(file: File): string | undefined {
  if (!IMAGE_TYPES.includes(file.type)) return "Use a JPG, PNG or WebP image."
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 2 MB or smaller."
  return undefined
}

/** A dashed drop area that previews the chosen file; the file itself is uploaded by the form. */
export function ImagePicker({
  htmlId,
  label,
  hint,
  file,
  error,
  required,
  currentUrl,
  onChange,
}: {
  htmlId: string
  label: string
  hint: string
  file: File | null
  error?: string
  required?: boolean
  /** The saved image, shown until a new file is chosen. */
  currentUrl?: string | null
  onChange: (file: File | null) => void
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])
  const shown = preview ?? currentUrl ?? null

  return (
    <Field htmlId={htmlId} label={label} error={error} required={required} hint={hint}>
      <label
        htmlFor={htmlId}
        className={cn(
          "flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary hover:bg-primary/5",
          error && "border-destructive"
        )}
      >
        {shown ? (
          <span role="img" aria-label={`${label} preview`} className="size-full bg-cover bg-center" style={{ backgroundImage: `url("${shown}")` }} />
        ) : (
          <span className="flex flex-col items-center gap-1">
            <ImagePlus aria-hidden className="size-6" /> Choose image
          </span>
        )}
        <input
          id={htmlId}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${htmlId}-error` : undefined}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </Field>
  )
}
