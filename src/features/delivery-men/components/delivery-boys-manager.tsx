"use client"

import { useCallback, useEffect, useState } from "react"
import { Bike, CircleAlert, Plus } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notify } from "@/components/shared/notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import {
  createDeliveryBoy,
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
import { squareCrop } from "../square-crop"
import type { ApplicationStatus, DeliveryBoy, DeliveryBoyFile, DeliveryLookups } from "../types"
import { DOCUMENT_TYPES, MAX_FILE_BYTES } from "../validation"
import { RiderForm, toCreateForm, toUpdateFields } from "./rider-form"

const fullName = (r: DeliveryBoy) => [r.firstName, r.lastName].filter(Boolean).join(" ")

function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  if (status === "approved") return <Badge variant="success">Approved</Badge>
  if (status === "denied") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="warning">Awaiting admin approval</Badge>
}

/** "My delivery boys": list, register, view, edit, files, switch on/off and delete. */
export function DeliveryBoysManager() {
  const [lookups, setLookups] = useState<DeliveryLookups | null>(null)
  const [riders, setRiders] = useState<DeliveryBoy[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [viewingId, setViewingId] = useState<number | null>(null)
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

  if (lookups && lookups.deliveryMode !== "SELF") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My delivery boys" />
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Delivery boys are available when the restaurant delivers its own orders. Choose “We deliver ourselves” in Restaurant profile → Delivery.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My delivery boys"
        description="Riders who deliver your orders. Foodi reviews each new registration before they can sign in."
        actions={
          <Button onClick={() => setAdding(true)} disabled={!lookups || lookups.zone === null}>
            <Plus aria-hidden /> Add delivery boy
          </Button>
        }
      />
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
                <TableHead>Application</TableHead>
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
                    <ApplicationBadge status={r.applicationStatus} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.accountStatus === "active" ? "success" : "secondary"}>{r.accountStatus}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add delivery boy</DialogTitle>
            <DialogDescription>Same details Foodi asks for on every delivery partner.</DialogDescription>
          </DialogHeader>
          {lookups ? (
            <RiderForm
              lookups={lookups}
              submitLabel="Register delivery boy"
              onSubmit={async (values, files) => {
                await createDeliveryBoy(toCreateForm(values, files))
                notify({ kind: "success", title: "Delivery boy registered", description: "Awaiting admin approval", preview: false })
                setAdding(false)
                reload()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

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

  const approved = rider.applicationStatus === "approved"
  const suspended = rider.accountStatus === "suspended"

  return (
    <>
      <SheetHeader>
        <SheetTitle>{fullName(rider)}</SheetTitle>
        <SheetDescription>
          <ApplicationBadge status={rider.applicationStatus} />
        </SheetDescription>
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
            <Detail label="Account">{rider.accountStatus}</Detail>
            <Detail label="Orders in progress">{rider.currentOrderCount}</Detail>
          </dl>
        )}
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {approved && !suspended ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await setDeliveryBoyStatus(rider.id, rider.accountStatus === "active" ? "inactive" : "active")
                    onChanged()
                  })
                }
              >
                {rider.accountStatus === "active" ? "Deactivate" : "Activate"}
              </Button>
            ) : null}
            <Button variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel editing
          </Button>
        )}
        {!approved ? (
          <p className="text-xs text-muted-foreground">Only Foodi can approve a delivery boy. You can activate them after approval.</p>
        ) : null}
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

  async function addDocument(file: File | undefined, type: "identity" | "other") {
    if (!file) return
    if (!DOCUMENT_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES) {
      setError("Each file must be a JPG, PNG or PDF of 2 MB or smaller.")
      return
    }
    await act(() => uploadDeliveryBoyDocument(riderId, type, file))
  }

  async function replacePhoto(file: File | undefined) {
    if (!file) return
    await act(async () => replaceDeliveryBoyPhoto(riderId, await squareCrop(file)))
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
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void replacePhoto(e.target.files?.[0])} />
        </label>
        <label className="flex flex-col gap-1">
          Add identity document
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => void addDocument(e.target.files?.[0], "identity")} />
        </label>
        <label className="flex flex-col gap-1">
          Add other document
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => void addDocument(e.target.files?.[0], "other")} />
        </label>
      </div>
    </section>
  )
}
