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

/**
 * Centre-crops the image to a square (PRD §5: 1:1) and compresses it, so the
 * copy sent with the form stays small. The real backend still validates and
 * compresses uploads itself.
 */
async function squareAndCompress(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("unreadable"))
      element.src = url
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const size = Math.min(side, OUTPUT_SIZE)
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no canvas")
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
    for (const quality of [0.85, 0.7, 0.55]) {
      let dataUrl = canvas.toDataURL("image/webp", quality)
      // Browsers without WebP encoding fall back to PNG; use JPEG instead.
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality)
      const bytes = imageDataUrlBytes(dataUrl)
      if (bytes !== null && bytes <= IMAGE_STORED_MAX_BYTES) return dataUrl
    }
    throw new Error("too large")
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ImagePicker({
  currentUrl,
  value,
  onChange,
  error,
}: {
  /** The saved image, if any. */
  currentUrl: string | null
  value: ImageChange
  onChange: (change: ImageChange) => void
  error?: string
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
      onChange({ kind: "replace", dataUrl: await squareAndCompress(file) })
    } catch {
      setLocalError("This image couldn't be read. Try another one.")
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:flex-col xl:flex-row">
      <div className="grid aspect-square size-28 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
        {processing ? (
          <Loader2 aria-hidden className="size-6 animate-spin" />
        ) : shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL preview
          <img src={shownUrl} alt="Item image" className="size-full object-cover" />
        ) : (
          <ImagePlus aria-hidden className="size-6" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id="item-image"
          type="file"
          accept={IMAGE_TYPES.join(",")}
          // Hidden from tab order; the "Choose image" button opens it.
          hidden
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-describedby="item-image-help"
            aria-disabled={processing || undefined}
            onClick={() => {
              if (!processing) inputRef.current?.click()
            }}
          >
            <ImagePlus aria-hidden />
            {shownUrl ? "Choose another image" : "Choose image"}
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
              Remove image
            </Button>
          ) : null}
        </div>
        {shownError ? (
          <p id="item-image-error" role="alert" className="text-sm text-destructive">
            {shownError}
          </p>
        ) : null}
        <p id="item-image-help" className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          JPG, PNG or WebP, up to 2 MB. It&apos;s cropped to a square from the centre.
        </p>
      </div>
    </div>
  )
}
