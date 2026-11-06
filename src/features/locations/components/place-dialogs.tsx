"use client"

import { useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { downloadQr, printCards, type PrintCard } from "../qr-print"
import { PLACE_TEXT, parseRows, type BulkInput, type Destination, type PlaceType } from "../types"
import { QrImage } from "./qr-image"

const MAX_BULK = 500
const errorText = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Please try again.")

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-foreground"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">{message}</p>
    </div>
  )
}

function GenerateNowOption({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <span>
        Generate QR code now
        <span className="block text-muted-foreground">Untick to save it without a QR code and generate it later.</span>
      </span>
    </label>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 aria-hidden className="animate-spin" />
          Saving…
        </>
      ) : (
        children
      )}
    </Button>
  )
}

// ---- add / rename one ----

type LabelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: PlaceType
  /** The location being renamed, or null when adding. */
  editing: Destination | null
  onSubmit: (label: string, generateQr: boolean) => Promise<void>
}

function LabelForm({ type, editing, onSubmit, onClose }: Omit<LabelDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const text = PLACE_TEXT[type]
  const id = useId()
  const [label, setLabel] = useState(editing?.label ?? "")
  const [generateQr, setGenerateQr] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (label.trim() === "") return setError(`Enter the ${text.one} number or name.`)
    setPending(true)
    setError(null)
    try {
      await onSubmit(label.trim(), generateQr)
      onClose()
    } catch (e) {
      setError(errorText(e))
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-5">
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor={`${id}-label`}>{text.Title} number or name</Label>
        <Input
          id={`${id}-label`}
          autoFocus
          autoComplete="off"
          maxLength={30}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="h-11 rounded-xl bg-white px-3.5 shadow-none"
        />
        <p className="text-xs text-muted-foreground">For example {text.example}. Must be unique in this restaurant.</p>
      </div>
      {editing ? null : <GenerateNowOption checked={generateQr} onChange={setGenerateQr} />}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <SubmitButton pending={pending}>{editing ? "Save changes" : `Add ${text.one}`}</SubmitButton>
      </DialogFooter>
    </form>
  )
}

export function LabelDialog({ open, onOpenChange, type, editing, onSubmit }: LabelDialogProps) {
  const text = PLACE_TEXT[type]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Rename ${text.one}` : `Add ${text.one}`}</DialogTitle>
          <DialogDescription>
            {editing
              ? "The QR code stays the same; only the name on the printed card changes."
              : "A new QR code is created for it."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <LabelForm type={type} editing={editing} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ---- add several ----

type BulkDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: PlaceType
  onSubmit: (body: BulkInput & { generateQr: boolean }) => Promise<void>
}

function BulkForm({ type, onSubmit, onClose }: Omit<BulkDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const text = PLACE_TEXT[type]
  const id = useId()
  const isSeat = type === "SEAT"
  const [mode, setMode] = useState<"range" | "list">("range")
  const [generateQr, setGenerateQr] = useState(true)
  const [prefix, setPrefix] = useState("")
  const [from, setFrom] = useState("1")
  const [to, setTo] = useState(isSeat ? "20" : "10")
  const [rowsText, setRowsText] = useState("A-F")
  const [list, setList] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const labels = list
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
  const rows = parseRows(rowsText)
  const span = Math.max(0, Number(to) - Number(from) + 1)
  const count = isSeat ? rows.length * span : mode === "range" ? span : labels.length
  const example = isSeat
    ? `${rows[0]}-${from}, ${rows[0]}-${Number(from) + 1}, … ${rows[rows.length - 1]}-${to}`
    : mode === "range"
      ? `${prefix}${from}, ${prefix}${Number(from) + 1}, … ${prefix}${to}`
      : labels.slice(0, 4).join(", ")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const wholeNumbers = from !== "" && to !== "" && Number.isInteger(Number(from)) && Number.isInteger(Number(to))
    if (isSeat && rows.length === 0) return setError("Enter the rows, like A-F or A, B, C.")
    if ((isSeat || mode === "range") && !wholeNumbers) return setError("Enter whole numbers for the start and the end.")
    if ((isSeat || mode === "range") && Number(to) < Number(from)) return setError("The end must be at least the start.")
    if (!isSeat && mode === "list" && labels.length === 0) return setError(`Enter at least one ${text.one} number.`)
    if (count > MAX_BULK) return setError(`At most ${MAX_BULK} ${text.many} at a time.`)
    setPending(true)
    setError(null)
    try {
      await onSubmit(
        isSeat
          ? { rows, seatFrom: Number(from), seatTo: Number(to), generateQr }
          : mode === "range"
            ? { prefix: prefix.trim(), from: Number(from), to: Number(to), generateQr }
            : { labels, generateQr },
      )
      onClose()
    } catch (e) {
      setError(errorText(e))
      setPending(false)
    }
  }

  const field = "h-11 rounded-xl bg-white px-3.5 shadow-none"

  return (
    <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-5">
      <FormError message={error} />
      {isSeat ? null : (
        <div className="flex gap-2" role="group" aria-label="How to add">
          <Button type="button" size="sm" variant={mode === "range" ? "default" : "outline"} onClick={() => setMode("range")}>
            Number range
          </Button>
          <Button type="button" size="sm" variant={mode === "list" ? "default" : "outline"} onClick={() => setMode("list")}>
            Custom list
          </Button>
        </div>
      )}

      {isSeat ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-rows`}>Rows</Label>
            <Input id={`${id}-rows`} className={field} value={rowsText} onChange={(e) => setRowsText(e.target.value)} />
            <p className="text-xs text-muted-foreground">A-F or A, B, C</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-from`}>First seat</Label>
            <Input id={`${id}-from`} className={field} inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-to`}>Last seat</Label>
            <Input id={`${id}-to`} className={field} inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      ) : mode === "range" ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-prefix`}>Prefix</Label>
            <Input id={`${id}-prefix`} className={field} maxLength={10} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <p className="text-xs text-muted-foreground">Optional, e.g. T</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-from`}>From</Label>
            <Input id={`${id}-from`} className={field} inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-to`}>To</Label>
            <Input id={`${id}-to`} className={field} inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${id}-list`}>{text.Title} numbers</Label>
          <Textarea
            id={`${id}-list`}
            rows={5}
            value={list}
            onChange={(e) => setList(e.target.value)}
            placeholder={"A1\nA2\nTerrace 1"}
          />
          <p className="text-xs text-muted-foreground">One per line, or separated by commas.</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count > 0 ? `${count} ${count === 1 ? text.one : text.many}: ${example}` : `No ${text.many} yet`}
      </p>

      <GenerateNowOption checked={generateQr} onChange={setGenerateQr} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || count === 0}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Creating…
            </>
          ) : (
            `Create ${count || ""} ${count === 1 ? text.one : text.many}`.replace(/\s+/g, " ")
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function BulkDialog({ open, onOpenChange, type, onSubmit }: BulkDialogProps) {
  const text = PLACE_TEXT[type]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add several {text.many}</DialogTitle>
          <DialogDescription>
            Each one gets its own QR code. If any {text.one} already exists in this restaurant, nothing is created.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <BulkForm type={type} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ---- preview ----

export function PreviewDialog({
  card,
  onOpenChange,
  onError,
}: {
  card: (PrintCard & { fileName: string }) | null
  onOpenChange: (open: boolean) => void
  onError: (error: unknown) => void
}) {
  return (
    <Dialog open={card !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {card ? (
          <>
            <DialogHeader>
              <DialogTitle>{card.heading}</DialogTitle>
              <DialogDescription>{card.title}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3">
              <QrImage url={card.url} size={240} label={card.heading} />
              <p className="max-w-full break-all text-center text-xs text-muted-foreground">{card.url}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => void downloadQr(card.url, card.fileName).catch(onError)}>
                Download PNG
              </Button>
              <Button onClick={() => void printCards([card]).catch(onError)}>Print</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
