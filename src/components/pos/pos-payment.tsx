"use client"

import { useId, useState } from "react"
import { Banknote, CreditCard, Printer, QrCode, SplitSquareHorizontal, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/orders/format"
import { cn } from "@/lib/utils"

import { lineTotal, subtotal, type CartLine } from "./pos-cart"

const METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: QrCode },
  { id: "wallet", label: "Digital wallet", icon: Wallet },
  { id: "split", label: "Split payment", icon: SplitSquareHorizontal },
] as const

type MethodId = (typeof METHODS)[number]["id"]

/**
 * Payment screen and receipt preview. Nothing is collected or recorded here: the point-of-sale ordering and
 * payment services aren't connected, so no method can complete. The cash helper only does arithmetic
 * (tendered minus the estimated subtotal), so the cashier can see the change to give.
 */
export function PosPaymentDialog({
  lines,
  locale,
  orderLabel,
  onClose,
}: {
  lines: CartLine[]
  locale: string
  orderLabel: string
  onClose: () => void
}) {
  const id = useId()
  const [method, setMethod] = useState<MethodId>("cash")
  const [tendered, setTendered] = useState("")
  const currency = lines[0]?.currency ?? "INR"
  const total = subtotal(lines)
  const tenderedMinor = Math.round(Number.parseFloat(tendered || "0") * 100)
  const change = tenderedMinor - total

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>{orderLabel}. Payment isn&apos;t connected yet, so nothing can be collected or recorded here.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Payment method</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {METHODS.map((entry) => {
                  const Icon = entry.icon
                  const selected = method === entry.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setMethod(entry.id)}
                      className={cn(
                        "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-sm font-semibold outline-none ring-1 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        selected ? "bg-primary-soft text-primary-text ring-primary" : "bg-card text-foreground ring-border-soft hover:bg-primary-faint"
                      )}
                    >
                      <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                      {entry.label}
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">Not connected</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {method === "cash" ? (
              <div className="grid gap-2 rounded-2xl bg-background/70 p-4 ring-1 ring-border-soft">
                <Label htmlFor={`${id}-tendered`}>Cash received ({currency})</Label>
                <Input id={`${id}-tendered`} inputMode="decimal" value={tendered} onChange={(event) => setTendered(event.target.value)} className="h-12 text-lg tabular-nums" placeholder="0.00" />
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200, 500].map((amount) => (
                    <Button key={amount} type="button" variant="outline" size="sm" onClick={() => setTendered(String(amount))}>
                      {amount}
                    </Button>
                  ))}
                </div>
                <p className="text-sm" aria-live="polite">
                  {tenderedMinor > 0 && tenderedMinor >= total ? (
                    <>Change to give: <span className="font-bold tabular-nums">{formatMoney({ amountMinor: change, currency }, locale)}</span></>
                  ) : tenderedMinor > 0 ? (
                    <span className="text-warning-foreground">Less than the estimated subtotal.</span>
                  ) : (
                    <span className="text-muted-foreground">Enter the cash received to see the change.</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-card/70 p-4 text-sm text-muted-foreground">
                {method === "card" ? "Card payments need a card terminal or provider-hosted checkout, and Foodi never takes card numbers here. " : method === "split" ? "Split payment needs payment recording to be connected. " : "This method needs a payment integration. "}
                It isn&apos;t connected yet.
              </p>
            )}
          </div>

          <section aria-labelledby={`${id}-receipt`} className="flex flex-col gap-3 rounded-2xl bg-background/70 p-4 ring-1 ring-border-soft">
            <h3 id={`${id}-receipt`} className="flex items-center justify-between text-sm font-semibold">
              Receipt preview
              <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-semibold text-neutral-foreground">Not a bill</span>
            </h3>
            <ul className="flex flex-col gap-2 text-sm">
              {lines.map((line) => (
                <li key={line.key} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-semibold tabular-nums">{line.quantity}×</span> {line.name}
                    {line.options.length > 0 ? <span className="block text-xs text-muted-foreground">{line.options.join(", ")}</span> : null}
                  </span>
                  <span className="tabular-nums">{formatMoney({ amountMinor: lineTotal(line), currency }, locale)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal (estimate)</dt>
                <dd className="tabular-nums">{formatMoney({ amountMinor: total, currency }, locale)}</dd>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt>Discounts, taxes and charges</dt>
                <dd>Applied by Foodi</dd>
              </div>
            </dl>
            <Button type="button" variant="outline" disabled className="w-fit">
              <Printer aria-hidden />
              Print receipt (not connected)
            </Button>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Back to order
          </Button>
          <Button type="button" size="lg" disabled aria-describedby={`${id}-why`}>
            Complete payment
          </Button>
        </DialogFooter>
        <p id={`${id}-why`} className="text-xs text-muted-foreground">
          Complete payment stays off until Foodi confirms the payment. Nothing is marked paid from this screen.
        </p>
      </DialogContent>
    </Dialog>
  )
}
