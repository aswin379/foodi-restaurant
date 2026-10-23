"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

// PROVISIONAL: accepted types and size limits are undecided (M6).
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

/**
 * Local preview only. The chosen file never leaves the browser: there is no
 * upload endpoint yet, and nothing here claims the image was saved.
 */
export function ImagePicker({ initialUrl }: { initialUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Release object URLs created for local previews.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function choose(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setError("Choose a JPG, PNG or WebP image.")
      return
    }
    setError(null)
    setFileName(file.name)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clear() {
    setPreviewUrl(null)
    setFileName(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={previewUrl} alt="Selected item image preview" className="size-full object-cover" />
        ) : (
          <ImagePlus aria-hidden className="size-6" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id="item-image"
          type="file"
          accept={ACCEPTED.join(",")}
          // Hidden from tab order; the "Choose image" button opens it.
          hidden
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden />
            {previewUrl ? "Choose another image" : "Choose image"}
          </Button>
          {previewUrl ? (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <Trash2 aria-hidden />
              Remove image
            </Button>
          ) : null}
        </div>
        {fileName ? <p className="text-xs text-foreground/80">Selected: {fileName}</p> : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p id="item-image-help" className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Optional. Preview only: images aren&apos;t uploaded yet, so the file stays in
          your browser. Backend integration pending.
        </p>
      </div>
    </div>
  )
}
