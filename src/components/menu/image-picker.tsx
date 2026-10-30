"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  IMAGE_STORED_MAX_BYTES,
  IMAGE_TYPES,
  IMAGE_UPLOAD_MAX_BYTES,
  imageDataUrlBytes,
  type ImageChange,
} from "@/lib/menu/validation"

const OUTPUT_SIZE = 800
/** Widest side kept for "original" shape images (e.g. a profile cover, B4a). */
const ORIGINAL_MAX_WIDTH = 1600

/** Extra downscaling steps, only for pickers with their own byte budget (B4a profile images). */
const SHRINK_STEPS = [0.75, 0.5, 0.35]

class TooLargeError extends Error {}

/**
 * Centre-crops the image to a square (PRD §5: 1:1) and compresses it, so the
 * copy sent with the form stays small. With `shape: "original"` it keeps the
 * image's shape and only scales it down. `shrinkToFit` also tries smaller
 * sizes when compression alone can't reach `maxBytes`. The real backend still
 * validates and compresses uploads itself.
 */
async function squareAndCompress(
  file: File,
  { shape, maxBytes, shrinkToFit }: { shape: "square" | "original"; maxBytes: number; shrinkToFit: boolean }
): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("unreadable"))
      element.src = url
    })
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no canvas")
    const draw = (scale: number) => {
      if (shape === "original") {
        const fit = Math.min(1, ORIGINAL_MAX_WIDTH / image.naturalWidth) * scale
        canvas.width = Math.max(1, Math.round(image.naturalWidth * fit))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * fit))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
      } else {
        const side = Math.min(image.naturalWidth, image.naturalHeight)
        const size = Math.max(1, Math.round(Math.min(side, OUTPUT_SIZE) * scale))
        canvas.width = size
        canvas.height = size
        context.drawImage(
          image,
          (image.naturalWidth - side) / 2,
          (image.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size
        )
      }
    }
    const encode = (quality: number) => {
      let dataUrl = canvas.toDataURL("image/webp", quality)
      // Browsers without WebP encoding fall back to PNG; use JPEG instead.
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality)
      const bytes = imageDataUrlBytes(dataUrl)
      return bytes !== null && bytes <= maxBytes ? dataUrl : null
    }
    draw(1)
    for (const quality of [0.85, 0.7, 0.55]) {
      const dataUrl = encode(quality)
      if (dataUrl) return dataUrl
    }
    if (shrinkToFit) {
      for (const scale of SHRINK_STEPS) {
        draw(scale)
        const dataUrl = encode(0.7) ?? encode(0.55)
        if (dataUrl) return dataUrl
      }
    }
    throw new TooLargeError("too large")
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ImagePicker({
  currentUrl,
  value,
  onChange,
  error,
  id = "item-image",
  alt = "Item image",
  shape = "square",
  help = "JPG, PNG or WebP, up to 2 MB. It's cropped to a square from the centre.",
  label,
  maxBytes,
}: {
  /** The saved image, if any. */
  currentUrl: string | null
  value: ImageChange
  onChange: (change: ImageChange) => void
  error?: string
  /** Element id prefix; the defaults are the menu item's (B2). */
  id?: string
  alt?: string
  shape?: "square" | "original"
  help?: string
  /** What the image is, for button names, e.g. "logo image" → "Choose logo image". Leave out for the menu's "Choose image". */
  label?: string
  /**
   * A tighter byte budget for the compressed copy (B4a profile images, so a
   * form with two images stays under the request limit). When set, the image
   * is also scaled down if compression alone isn't enough. Menu images (B2)
   * keep the default budget and behaviour.
   */
  maxBytes?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const shownUrl = value.kind === "replace" ? value.dataUrl : value.kind === "remove" ? null : currentUrl
  const shownError = localError ?? error

  async function choose(file: File | undefined) {
    if (!file) return
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setLocalError("Choose a JPG, PNG or WebP image.")
      return
    }
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      setLocalError("Choose an image of 2 MB or less.")
      return
    }
    setLocalError(null)
    setProcessing(true)
    try {
      onChange({
        kind: "replace",
        dataUrl: await squareAndCompress(file, {
          shape,
          maxBytes: maxBytes ?? IMAGE_STORED_MAX_BYTES,
          shrinkToFit: maxBytes !== undefined,
        }),
      })
    } catch (failure) {
      setLocalError(
        maxBytes !== undefined && failure instanceof TooLargeError
          ? "This image is still too large after compression. Try a smaller or less detailed image."
          : "This image couldn't be read. Try another one."
      )
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={shape === "square" ? "flex flex-col gap-3 sm:flex-row sm:items-start lg:flex-col xl:flex-row" : "flex min-w-0 flex-col gap-3"}>
      <div
        className={
          shape === "square"
            ? "grid aspect-square size-28 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground"
            : "grid aspect-[3/1] w-full max-w-sm place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground"
        }
      >
        {processing ? (
          <Loader2 aria-hidden className="size-6 animate-spin" />
        ) : shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL preview
          <img src={shownUrl} alt={alt} className="size-full object-cover" />
        ) : (
          <ImagePlus aria-hidden className="size-6" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          // Hidden from tab order; the "Choose …" button opens it.
          hidden
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            // The visible control for this image: error-summary links focus it, not the hidden input.
            id={`${id}-button`}
            type="button"
            variant="outline"
            size="sm"
            aria-describedby={[`${id}-help`, shownError ? `${id}-error` : null].filter(Boolean).join(" ")}
            aria-disabled={processing || undefined}
            onClick={() => {
              if (!processing) inputRef.current?.click()
            }}
          >
            <ImagePlus aria-hidden />
            {shownUrl ? `Choose another ${label ?? "image"}` : `Choose ${label ?? "image"}`}
          </Button>
          {shownUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalError(null)
                onChange(currentUrl ? { kind: "remove" } : { kind: "keep" })
              }}
            >
              <Trash2 aria-hidden />
              Remove {label ?? "image"}
            </Button>
          ) : null}
        </div>
        {shownError ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-danger-foreground">
            {shownError}
          </p>
        ) : null}
        <p id={`${id}-help`} className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {help}
        </p>
      </div>
    </div>
  )
}
