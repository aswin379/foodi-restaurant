"use client"

import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { toQrDataUrl } from "../qr-print"

export function QrImage({ url, size = 160, label }: { url: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    toQrDataUrl(url).then(
      (dataUrl) => {
        if (!cancelled) {
          setSrc(dataUrl)
          setFailed(false)
        }
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])

  if (failed) return <p className="text-sm text-danger-foreground">Could not draw the QR code.</p>
  if (!src) return <Skeleton style={{ width: size, height: size }} />
  // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a file Next can optimise
  return <img src={src} alt={`QR code for ${label}`} width={size} height={size} className="rounded-xl border bg-white" />
}
