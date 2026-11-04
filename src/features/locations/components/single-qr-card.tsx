"use client"

import { useState } from "react"
import { Download, Printer, QrCode, RefreshCw } from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notify } from "@/components/shared/notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

import { createSingleQr, regenerateQr, setDestinationActive } from "../location-service"
import { downloadQr, printCards } from "../qr-print"
import type { LocationsOverview } from "../types"
import { QrImage } from "./qr-image"

const fail = (error: unknown) =>
  notify({ kind: "error", title: "Nothing was changed", description: error instanceof Error ? error.message : undefined })
const done = (title: string) => notify({ kind: "success", title, preview: false })

/** The restaurant's single QR: opens the menu with no table, room or seat; the customer then picks how to order and where. */
export function SingleQrCard({
  restaurantName,
  overview,
  canManage,
  onChanged,
}: {
  restaurantName: string
  overview: LocationsOverview
  canManage: boolean
  onChanged: () => void
}) {
  const single = overview.general
  const url = single?.url ?? null
  const { takeAway, delivery, dineIn, roomService, theaterService } = overview.services
  const anyWayOn = takeAway || delivery || dineIn || roomService || theaterService
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      done(success)
      onChanged()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Single QR" className="flex flex-col gap-4 rounded-2xl bg-card px-5 py-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <div>
        <h2 className="text-lg font-semibold">Single QR</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          One QR for the whole restaurant, for the entrance, posters and flyers. It opens your menu without a table, room
          or seat. The customer then chooses how to order and, for dine-in, room service or theater, picks the place.
        </p>
      </div>

      {single === null || url === null ? (
        !anyWayOn ? (
          <p className="text-sm text-muted-foreground">
            Turn on a way of ordering in Settings, Order options, to use the single QR.
          </p>
        ) : canManage ? (
          <div>
            <Button disabled={busy} onClick={() => void run(createSingleQr, "Single QR created")}>
              <QrCode aria-hidden />
              {busy ? "Creating…" : "Create single QR"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">There is no single QR yet.</p>
        )
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <QrImage url={url} size={160} label="the single QR" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={single.isActive ? "secondary" : "outline"}>{single.isActive ? "Active" : "Disabled"}</Badge>
              {!anyWayOn ? <Badge variant="destructive">Every way of ordering is off, so this QR does not work</Badge> : null}
            </div>
            <p className="break-all text-xs text-muted-foreground">{url}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void downloadQr(url, `${restaurantName}-single`).catch(fail)}>
                <Download aria-hidden />
                Download PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void printCards([{ title: restaurantName, heading: "Scan to order", url }]).catch(fail)}
              >
                <Printer aria-hidden />
                Print
              </Button>
              {canManage ? (
                <>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
                    <RefreshCw aria-hidden />
                    Regenerate
                  </Button>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={single.isActive}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        void run(() => setDestinationActive(single.id, checked), checked ? "Single QR enabled" : "Single QR disabled")
                      }
                      aria-label="Single QR is active"
                    />
                    Active
                  </label>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Regenerate the single QR code?"
        description="This creates a new QR link. Every printed copy of the old QR code stops working and must be replaced. To only get the image again, use Download instead."
        confirmLabel="Regenerate"
        destructive
        pending={busy}
        onConfirm={() => {
          if (!single) return
          void run(() => regenerateQr(single.id), "New QR code created. Print and replace the old one.").then(() =>
            setConfirming(false),
          )
        }}
      />
    </section>
  )
}
