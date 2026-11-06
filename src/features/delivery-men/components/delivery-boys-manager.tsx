"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bike, CircleAlert, Plus } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ImageCropDialog } from "@/components/shared/image-crop-dialog"
import { notify } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import {
  deleteDeliveryBoy,
  deleteDeliveryBoyDocument,
  getDeliveryBoyFileUrl,
  getDeliveryLookups,
  listDeliveryBoyFiles,
  listDeliveryBoys,
  replaceDeliveryBoyPhoto,
  setDeliveryBoyStatus,
  updateDeliveryBoy,
  uploadDeliveryBoyDocument,
} from "../delivery-men-service"
import type { DeliveryBoy, DeliveryBoyFile, DeliveryLookups } from "../types"
import { IMAGE_SOURCE_TYPES, checkSourceImage } from "../validation"
import { ActiveSwitch } from "./active-switch"
import { RiderForm, toUpdateFields } from "./rider-form"

const fullName = (r: DeliveryBoy) => [r.firstName, r.lastName].filter(Boolean).join(" ")

/** Delivery boys: list, register, view, edit, files, switch on/off and delete. */
export function DeliveryBoysManager() {
  const [lookups, setLookups] = useState<DeliveryLookups | null>(null)
  const [riders, setRiders] = useState<DeliveryBoy[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let alive = true
    Promise.all([getDeliveryLookups(), listDeliveryBoys()])
      .then(([l, page]) => {
        if (!alive) return
        setLookups(l)
        setRiders(page.items)
        setError(null)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load your delivery boys."))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const viewing = riders?.find((r) => r.id === viewingId) ?? null

  // The seller switches a delivery boy on or off straight from the list; the server checks it is theirs.
  async function toggle(rider: DeliveryBoy, next: "active" | "inactive") {
    if (togglingId !== null) return
    setTogglingId(rider.id)
    setToggleError(null)
    try {
      await setDeliveryBoyStatus(rider.id, next)
      reload()
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : "Nothing was changed.")
    } finally {
      setTogglingId(null)
    }
  }

  if (lookups && lookups.deliveryMode !== "SELF") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Delivery boys" />
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Delivery boys are available when the restaurant delivers its own orders. Choose &ldquo;We deliver ourselves&rdquo; in
          Restaurant profile &rarr; Delivery and timing.
        </p>
      </div>
    )
  }

  const noZone = lookups !== null && lookups.zone === null
  const noneActive = riders !== null && riders.length > 0 && !riders.some((r) => r.accountStatus === "active")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Delivery boys"
        description="Riders who deliver your orders. Switch a delivery boy on or off any time."
        actions={
          !lookups || noZone ? (
            <Button disabled>
              <Plus aria-hidden /> Add delivery boy
            </Button>
          ) : (
            <Button asChild>
              <Link href="/delivery-boys/new">
                <Plus aria-hidden /> Add delivery boy
              </Link>
            </Button>
          )
        }
      />
      {noZone ? (
        <p role="alert" className="rounded-2xl bg-card p-4 text-sm text-danger-foreground">
          Set your restaurant location in Restaurant profile first, so it is placed in a delivery zone. Then you can add delivery boys.
        </p>
      ) : null}
      {noneActive ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">
          No delivery boy is switched on. Turn one on to receive your own delivery orders.
        </p>
      ) : null}
      {toggleError ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
          <CircleAlert aria-hidden className="size-4" /> {toggleError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
          <CircleAlert aria-hidden className="size-4" /> {error}
        </p>
      ) : null}
      {riders === null && !error ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : riders && riders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-10 text-center">
          <Bike aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-medium">No delivery boys yet</p>
          <p className="text-sm text-muted-foreground">Add one to start delivering your own orders.</p>
        </div>
      ) : riders ? (
        <div className="rounded-2xl bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riders.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setViewingId(r.id)}>
                  <TableCell>
                    <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setViewingId(r.id)}>
                      {fullName(r)}
                    </button>
                    <div className="text-xs text-muted-foreground">{r.phoneNumber}</div>
                    {r.applicationStatus === "denied" && r.denialReason ? (
                      <div className="mt-0.5 text-xs text-danger-foreground">Rejected: {r.denialReason}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.vehicle.name}</TableCell>
                  <TableCell>{r.zone.name}</TableCell>
                  <TableCell>
                    <ActiveSwitch rider={r} busy={togglingId === r.id} onToggle={(next) => void toggle(r, next)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Sheet open={viewing !== null} onOpenChange={(open) => !open && setViewingId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {viewing && lookups ? (
            <RiderDetails
              rider={viewing}
              lookups={lookups}
              onChanged={reload}
              onDeleted={() => {
                setViewingId(null)
                reload()
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function RiderDetails({
  rider,
  lookups,
  onChanged,
  onDeleted,
}: {
  rider: DeliveryBoy
  lookups: DeliveryLookups
  onChanged: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nothing was changed.")
    } finally {
      setBusy(false)
    }
  }

  const suspended = rider.accountStatus === "suspended"

  return (
    <>
      <SheetHeader>
        <SheetTitle>{fullName(rider)}</SheetTitle>
        <SheetDescription>{rider.email}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        {error ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {error}
          </p>
        ) : null}
        {rider.applicationStatus === "denied" && rider.denialReason ? (
          <p className="text-sm text-muted-foreground">Rejected: {rider.denialReason}</p>
        ) : null}
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm font-medium">Status</span>
          <ActiveSwitch
            rider={rider}
            busy={busy}
            onToggle={(next) =>
              void run(async () => {
                await setDeliveryBoyStatus(rider.id, next)
                onChanged()
              })
            }
          />
        </div>
        {editing ? (
          <RiderForm
            lookups={lookups}
            rider={rider}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await updateDeliveryBoy(rider.id, toUpdateFields(values))
              notify({ kind: "success", title: "Delivery boy updated", preview: false })
              setEditing(false)
              onChanged()
            }}
          />
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Email">{rider.email}</Detail>
            <Detail label="Phone">{rider.phoneNumber}</Detail>
            <Detail label="Vehicle">{rider.vehicle.name}</Detail>
            <Detail label="Zone">{rider.zone.name}</Detail>
            <Detail label="Type">{rider.deliveryManType === "freelance" ? "Freelance" : "Salary based"}</Detail>
            <Detail label="Identity">
              {rider.identityDocumentType.replace("_", " ")} · {rider.identityDocumentNumber}
            </Detail>
            <Detail label="Orders in progress">{rider.currentOrderCount}</Detail>
          </dl>
        )}
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel editing
          </Button>
        )}
        {suspended ? <p className="text-xs text-muted-foreground">This delivery boy was suspended by Foodi. Contact support to reinstate.</p> : null}
        <RiderFiles riderId={rider.id} />
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this delivery boy?"
        description="Their record and uploaded documents are removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={busy}
        onConfirm={() =>
          void run(async () => {
            try {
              await deleteDeliveryBoy(rider.id)
              notify({ kind: "success", title: "Delivery boy deleted", preview: false })
              onDeleted()
            } finally {
              setConfirmDelete(false)
            }
          })
        }
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-break-word">{children}</dd>
    </div>
  )
}

function RiderFiles({ riderId }: { riderId: number }) {
  const [files, setFiles] = useState<DeliveryBoyFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    let alive = true
    listDeliveryBoyFiles(riderId)
      .then((f) => alive && setFiles(f))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load files."))
    return () => {
      alive = false
    }
  }, [riderId, key])

  async function act(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      setKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nothing was changed.")
    }
  }

  async function open(fileId: number) {
    await act(async () => {
      window.open(await getDeliveryBoyFileUrl(riderId, fileId), "_blank", "noopener,noreferrer")
    })
  }

  const [job, setJob] = useState<{ kind: "photo" | "identity" | "other"; queue: File[]; total: number } | null>(null)

  function pick(input: HTMLInputElement, kind: "photo" | "identity" | "other") {
    const picked = Array.from(input.files ?? [])
    input.value = "" // lets the same file be picked again
    if (picked.length === 0) return
    const problem = picked.map(checkSourceImage).find((message) => message !== null)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setJob({ kind, queue: picked, total: picked.length })
  }

  const next = () => setJob((j) => (j && j.queue.length > 1 ? { ...j, queue: j.queue.slice(1) } : null))

  // Each image is cropped to a square first, then uploaded straight away; the server re-checks that it is square.
  async function upload(cropped: File) {
    if (!job) return
    const { kind } = job
    next()
    await act(async () => {
      if (kind === "photo") await replaceDeliveryBoyPhoto(riderId, cropped)
      else await uploadDeliveryBoyDocument(riderId, kind, cropped)
    })
  }

  return (
    <section aria-label="Files" className="flex flex-col gap-3">
      <h3 className="font-semibold">Photo and documents</h3>
      {error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2 text-sm">
        {(files ?? []).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
            <span>
              {f.kind === "profile" ? "Profile photo" : `${f.documentType ?? "document"} document`} · {Math.ceil(f.sizeBytes / 1024)} KB
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void open(f.id)}>
                View
              </Button>
              {f.kind === "document" ? (
                <Button size="sm" variant="ghost" onClick={() => void act(() => deleteDeliveryBoyDocument(riderId, f.id))}>
                  Remove
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 text-sm">
        <label className="flex flex-col gap-1">
          Replace photo
          <input type="file" accept={IMAGE_SOURCE_TYPES.join(",")} onChange={(e) => pick(e.target, "photo")} />
        </label>
        <label className="flex flex-col gap-1">
          Add identity images
          <input type="file" multiple accept={IMAGE_SOURCE_TYPES.join(",")} onChange={(e) => pick(e.target, "identity")} />
        </label>
        <label className="flex flex-col gap-1">
          Add other documents (images)
          <input type="file" multiple accept={IMAGE_SOURCE_TYPES.join(",")} onChange={(e) => pick(e.target, "other")} />
        </label>
      </div>
      <ImageCropDialog
        file={job?.queue[0] ?? null}
        title={job?.kind === "photo" ? "Crop profile photo" : "Crop image"}
        description={job && job.total > 1 ? `Image ${job.total - job.queue.length + 1} of ${job.total}. Drag to reposition, use the slider to zoom.` : undefined}
        confirmLabel="Upload"
        onCancel={next}
        onConfirm={(cropped) => void upload(cropped)}
      />
    </section>
  )
}
