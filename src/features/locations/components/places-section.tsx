"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleAlert, Download, Eye, Pencil, Plus, Printer, QrCode, RefreshCw, Search } from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notify } from "@/components/shared/notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

import {
  bulkCreate,
  createDestination,
  generateMissing,
  generateQr,
  listAllDestinations,
  listDestinations,
  regenerateQr,
  renameDestination,
  setDestinationActive,
} from "../location-service"
import { downloadQr, printCards, type PrintCard } from "../qr-print"
import { PLACE_TEXT, type Destination, type DestinationPage, type PlaceType } from "../types"
import { BulkDialog, LabelDialog, PreviewDialog } from "./place-dialogs"

const PAGE_SIZE = 20

const messageOf = (error: unknown) => (error instanceof Error ? error.message : undefined)
const fail = (error: unknown) => notify({ kind: "error", title: "Nothing was changed", description: messageOf(error) })
const done = (title: string, description?: string) => notify({ kind: "success", title, description, preview: false })

type Props = {
  restaurantName: string
  type: PlaceType
  canManage: boolean
  /** Called after a change so the page can refresh the counts. */
  onChanged: () => void
}

/** Tables, rooms or seats of the restaurant: search, pages, add one or several, and the per-QR actions. The parent keys it by type. */
export function PlacesSection({ restaurantName, type, canManage, onChanged }: Props) {
  const text = PLACE_TEXT[type]

  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DestinationPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [renaming, setRenaming] = useState<Destination | null>(null)
  const [regenerating, setRegenerating] = useState<Destination | null>(null)
  const [preview, setPreview] = useState<(PrintCard & { fileName: string }) | null>(null)
  const [busy, setBusy] = useState<number | "all" | "print" | null>(null)

  // Wait for the typing to pause, and go back to the first page for a new search.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setError(null)
    try {
      setData(await listDestinations({ type, q: q || undefined, page, pageSize: PAGE_SIZE }))
    } catch (e) {
      setError(messageOf(e) ?? `Could not load your ${text.many}.`)
    }
  }, [type, q, page, text.many])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the search or page changes
    void load()
  }, [load])

  const changed = useCallback(async () => {
    await load()
    onChanged()
  }, [load, onChanged])

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.items ?? []
  const missingQr = data?.missingQr ?? 0

  const cardOf = (item: Destination, url: string): PrintCard & { fileName: string } => ({
    title: restaurantName,
    heading: `${text.Title} ${item.label}`,
    url,
    fileName: `${restaurantName}-${text.one}-${item.label}`,
  })

  async function run(id: number | "all", action: () => Promise<void>, success: string) {
    if (busy !== null) return
    setBusy(id)
    try {
      await action()
      done(success)
      await changed()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  async function printAll() {
    setBusy("print")
    try {
      const all = await listAllDestinations({ type, q: q || undefined })
      const cards = all.flatMap((item) => (item.isActive && item.url !== null ? [cardOf(item, item.url)] : []))
      if (cards.length === 0) throw new Error(`No ${text.many} with a QR code to print.`)
      await printCards(cards)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  async function generateAll() {
    if (busy !== null) return
    setBusy("all")
    try {
      const result = await generateMissing({ type })
      const note = result.skipped > 0 ? `, ${result.skipped} already had one` : ""
      if (result.failed > 0) {
        notify({
          kind: "error",
          title: `${result.generated} generated${note}, ${result.failed} failed`,
          description: "Try again to finish them.",
        })
      } else {
        done(`${result.generated} QR ${result.generated === 1 ? "code" : "codes"} generated${note}`)
      }
      await changed()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label={text.TitleMany}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {text.TitleMany}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null || total === 0} onClick={() => void printAll()}>
            <Printer aria-hidden />
            {busy === "print" ? "Preparing…" : "Print all"}
          </Button>
          {canManage && missingQr > 0 ? (
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void generateAll()}>
              <QrCode aria-hidden />
              {busy === "all" ? "Generating…" : `Generate missing QR codes (${missingQr})`}
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setBulk(true)}>
                <Plus aria-hidden />
                Add several
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                Add {text.one}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search aria-hidden className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
        <Input
          className="h-10 rounded-xl bg-white pl-9 shadow-none"
          placeholder={`Search ${text.many}`}
          aria-label={`Search ${text.many}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-4 text-sm text-danger-foreground">
          <p className="flex items-center gap-2">
            <CircleAlert aria-hidden className="size-4" />
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : data === null ? (
        <div role="status" aria-label={`Loading ${text.many}`} className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <QrCode aria-hidden className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">{q ? `No ${text.many} match "${q}"` : `No ${text.many} yet`}</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            {q
              ? "Try a different search."
              : canManage
                ? `Add a ${text.one}, or several at once, to get a QR code for each.`
                : null}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-card px-5 py-4 shadow-[0_8px_30px_rgb(31_26_23/6%)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="truncate">{item.label}</span>
                    <Badge variant={item.isActive ? "secondary" : "outline"}>{item.isActive ? "Active" : "Disabled"}</Badge>
                    <Badge variant={item.qrGenerated ? "secondary" : "outline"}>
                      {item.qrGenerated ? "QR ready" : "No QR yet"}
                    </Badge>
                  </p>
                </div>
                {canManage ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={item.isActive}
                      disabled={busy !== null}
                      onCheckedChange={(checked) =>
                        void run(item.id, async () => void (await setDestinationActive(item.id, checked)), `${text.Title} ${item.label} ${checked ? "enabled" : "disabled"}`)
                      }
                      aria-label={`${text.Title} ${item.label} is active`}
                    />
                    Active
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {item.url !== null ? (
                    <>
                      <Button variant="ghost" size="icon" aria-label={`Preview ${text.one} ${item.label}`} title="Preview" onClick={() => setPreview(cardOf(item, item.url as string))}>
                        <Eye aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Download QR for ${text.one} ${item.label}`}
                        title="Download PNG"
                        onClick={() => void downloadQr(item.url as string, cardOf(item, item.url as string).fileName).catch(fail)}
                      >
                        <Download aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Print ${text.one} ${item.label}`}
                        title="Print"
                        onClick={() => void printCards([cardOf(item, item.url as string)]).catch(fail)}
                      >
                        <Printer aria-hidden />
                      </Button>
                    </>
                  ) : null}
                  {canManage ? (
                    <>
                      {item.url === null ? (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Generate QR for ${text.one} ${item.label}`}
                          disabled={busy !== null}
                          onClick={() => void run(item.id, async () => void (await generateQr(item.id)), `QR code generated for ${text.one} ${item.label}`)}
                        >
                          <QrCode aria-hidden />
                          Generate QR
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon" aria-label={`Rename ${text.one} ${item.label}`} title="Rename" onClick={() => setRenaming(item)}>
                        <Pencil aria-hidden />
                      </Button>
                      {item.url !== null ? (
                        <Button variant="ghost" size="icon" aria-label={`Regenerate QR for ${text.one} ${item.label}`} title="Regenerate (new QR link)" onClick={() => setRegenerating(item)}>
                          <RefreshCw aria-hidden />
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} {total === 1 ? text.one : text.many}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <LabelDialog
        open={adding}
        onOpenChange={setAdding}
        type={type}
        editing={null}
        onSubmit={async (label, generate) => {
          // The server derives a seat's row from its name ("A-14" -> row A).
          await createDestination({ type, label, generateQr: generate })
          done(generate ? `${text.Title} ${label} added` : `${text.Title} ${label} saved without a QR code`)
          await changed()
        }}
      />
      <LabelDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        type={type}
        editing={renaming}
        onSubmit={async (label) => {
          await renameDestination(renaming?.id ?? 0, label)
          done(`Renamed to ${text.one} ${label}`)
          await changed()
        }}
      />
      <BulkDialog
        open={bulk}
        onOpenChange={setBulk}
        type={type}
        onSubmit={async (body) => {
          const result = await bulkCreate({ type, ...body })
          done(`${result.created} ${text.many} added${body.generateQr ? "" : " without QR codes"}`)
          await changed()
        }}
      />
      <PreviewDialog card={preview} onOpenChange={(open) => !open && setPreview(null)} onError={fail} />
      <ConfirmDialog
        open={regenerating !== null}
        onOpenChange={(open) => !open && setRegenerating(null)}
        title={`Regenerate the QR code for ${text.one} ${regenerating?.label ?? ""}?`}
        description="This creates a new QR link. Every printed copy of the old QR code stops working and must be replaced. To only get the image again, use Download instead."
        confirmLabel="Regenerate"
        destructive
        pending={busy !== null}
        onConfirm={() => {
          const target = regenerating
          if (!target) return
          void run(target.id, async () => void (await regenerateQr(target.id)), "New QR code created. Print and replace the old one.").then(() =>
            setRegenerating(null),
          )
        }}
      />
    </section>
  )
}
