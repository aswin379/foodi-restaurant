"use client"

import { useId, useMemo, useState } from "react"
import Link from "next/link"
import { Bike, ImageIcon, Info, Minus, Plus, Search, ShoppingBag, Store, Trash2, UtensilsCrossed } from "lucide-react"

import { DietaryMark } from "@/components/menu/item-status-badge"
import { OrderStatusBadge } from "@/components/orders/status-badges"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import { displayPrice, itemStatus } from "@/lib/menu/rules"
import type { MenuCategory, MenuItem } from "@/lib/menu/types"
import { formatMoney } from "@/lib/orders/format"
import type { OrderDetail } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

import { lineFrom, lineTotal, money, needsChoices, subtotal, type CartLine } from "./pos-cart"
import { PosItemDialog } from "./pos-item-dialog"
import { PosPaymentDialog } from "./pos-payment"

const SURFACE = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"
const TYPE_ICON = { delivery: Bike, takeaway: Store, dine_in: UtensilsCrossed } as const

type Dialog_ = null | { kind: "item"; item: MenuItem } | { kind: "payment" } | { kind: "send" } | { kind: "clear" }

/**
 * Point-of-sale workspace. The catalogue is the restaurant's real menu data; the order being built stays in
 * this browser tab. Sending it to the kitchen, taking payment, tables, customers and printing need services
 * that aren't connected, so each says so and none pretends to succeed.
 */
export function PosWorkspace({
  items,
  categories,
  activeOrders,
  locale,
}: {
  items: MenuItem[]
  categories: MenuCategory[]
  /** Null when the orders couldn't be loaded. */
  activeOrders: OrderDetail[] | null
  locale: string
}) {
  const [tab, setTab] = useState<"new" | "active">("new")
  const [type, setType] = useState<OrderType>("dine_in")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string | "all">("all")
  const [lines, setLines] = useState<CartLine[]>([])
  const [dialog, setDialog] = useState<Dialog_>(null)
  const [context, setContext] = useState({ table: "", name: "", phone: "", address: "", note: "" })
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const shownCategories = categories.filter((category) => !category.archived && category.active).sort((a, b) => a.position - b.position)
  const currency = items[0]?.price.currency ?? "INR"
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)

  const visible = items.filter(
    (item) =>
      (categoryId === "all" || item.categoryId === categoryId) &&
      (search.trim() === "" || item.name.toLowerCase().includes(search.trim().toLowerCase()))
  )

  const add = (line: Omit<CartLine, "key">) => {
    setLines((current) => {
      const same = current.find((existing) => existing.itemId === line.itemId && existing.options.join("|") === line.options.join("|") && existing.note === line.note)
      if (same) return current.map((existing) => (existing === same ? { ...existing, quantity: Math.min(50, existing.quantity + line.quantity) } : existing))
      return [...current, { ...line, key: `${line.itemId}-${current.length}-${Date.now()}` }]
    })
  }
  const choose = (item: MenuItem) => {
    if (needsChoices(item)) setDialog({ kind: "item", item })
    else {
      const { key: _key, ...line } = lineFrom(item, { sizeId: null, options: {}, quantity: 1, note: "" }, "new")
      void _key
      add(line)
    }
  }
  const setQuantity = (key: string, quantity: number) =>
    setLines((current) => (quantity <= 0 ? current.filter((line) => line.key !== key) : current.map((line) => (line.key === key ? { ...line, quantity: Math.min(50, quantity) } : line))))

  const orderLabel = `${orderTypeLabels[type]}${type === "dine_in" && context.table ? `, ${context.table}` : ""}`

  const cart = (
    <CartPanel
      lines={lines}
      type={type}
      locale={locale}
      currency={currency}
      context={context}
      onContext={(patch) => setContext({ ...context, ...patch })}
      onQuantity={setQuantity}
      onSend={() => setDialog({ kind: "send" })}
      onPay={() => setDialog({ kind: "payment" })}
      onClear={() => setDialog({ kind: "clear" })}
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="POS views" className={cn("flex w-fit gap-1 rounded-full bg-card p-1", SURFACE)}>
          {(["new", "active"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                tab === value ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]" : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              {value === "new" ? "New order" : "Active orders"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Order type" className={cn("flex w-fit gap-1 rounded-full bg-card p-1", SURFACE)}>
          {ORDER_TYPES.slice()
            .sort((a, b) => ["dine_in", "takeaway", "delivery"].indexOf(a) - ["dine_in", "takeaway", "delivery"].indexOf(b))
            .map((value) => {
              const Icon = TYPE_ICON[value]
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    type === value ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]" : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {orderTypeLabels[value]}
                </button>
              )
            })}
        </div>
      </div>

      {tab === "active" ? (
        <ActiveOrders orders={activeOrders} locale={locale} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <section aria-label="Menu" className="flex min-w-0 flex-col gap-4">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search menu items"
                placeholder="Search menu items"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 rounded-full bg-card pl-12 text-base shadow-xs"
              />
            </div>
            <nav aria-label="Categories">
              <ul className="flex flex-wrap gap-2">
                {[{ id: "all", name: "All items" }, ...shownCategories].map((category) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      aria-pressed={categoryId === category.id}
                      onClick={() => setCategoryId(category.id)}
                      className={cn(
                        "inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        categoryId === category.id ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]" : "bg-card text-foreground shadow-xs hover:bg-primary-faint"
                      )}
                    >
                      {category.name}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            {visible.length === 0 ? (
              <p className={cn("rounded-3xl bg-card px-6 py-12 text-center text-sm text-muted-foreground", SURFACE)}>No menu items match.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {visible.map((item) => {
                  const status = itemStatus(item, categoryById.get(item.categoryId) ?? null)
                  const blocked = status.kind !== "available" ? (status.kind === "sold_out" ? "Sold out" : "Unavailable") : status.offFor.includes(type) ? `Not for ${orderTypeLabels[type].toLowerCase()}` : null
                  const { from, price } = displayPrice(item)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={blocked !== null}
                        onClick={() => choose(item)}
                        className={cn(
                          "flex h-full w-full flex-col overflow-hidden rounded-2xl bg-card text-left outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50 enabled:hover:shadow-[0_12px_36px_rgb(214_63_8/16%)] disabled:opacity-60",
                          SURFACE
                        )}
                      >
                        <span aria-hidden className="grid h-24 w-full place-items-center bg-primary-soft text-primary-text">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote image hosts aren't configured yet
                            <img src={item.imageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageIcon className="size-7" strokeWidth={1.5} />
                          )}
                        </span>
                        <span className="flex flex-1 flex-col gap-1 p-3">
                          <span className="flex items-start gap-1.5">
                            <DietaryMark dietary={item.dietary} />
                            <span className="text-sm leading-snug font-semibold">{item.name}</span>
                          </span>
                          <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                            <span className="text-sm font-bold tabular-nums">
                              {from ? <span className="font-normal text-muted-foreground">From </span> : null}
                              {formatMoney(price, locale)}
                            </span>
                            {blocked ? (
                              <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-semibold text-neutral-foreground">{blocked}</span>
                            ) : (
                              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                                <Plus className="size-4" />
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="sr-only">{blocked ? `, ${blocked}` : needsChoices(item) ? ", choose options" : ", add to order"}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <aside aria-label="Current order" className="sticky top-20 hidden lg:block">
            {cart}
          </aside>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-background/90 p-3 backdrop-blur-md lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="lg" className="h-14 w-full justify-between text-base">
                  <span className="flex items-center gap-2">
                    <ShoppingBag aria-hidden />
                    View order · {count} {count === 1 ? "item" : "items"}
                  </span>
                  <span className="tabular-nums">{formatMoney(money(subtotal(lines), currency), locale)}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Current order</SheetTitle>
                  <SheetDescription>{orderLabel}</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-6">{cart}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {dialog?.kind === "item" ? <PosItemDialog item={dialog.item} locale={locale} onAdd={(line) => { add(line); setDialog(null) }} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "payment" ? <PosPaymentDialog lines={lines} locale={locale} orderLabel={orderLabel} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "send" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sending orders isn&apos;t connected yet</DialogTitle>
              <DialogDescription>
                Placing an order from here needs Foodi&apos;s order-entry service, which isn&apos;t connected. Your order stays on this screen, and nothing has been sent to the kitchen or saved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setDialog(null)}>
                Back to order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === "clear"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Clear this order?"
        description="All items are removed from the order on this screen. Nothing has been sent or saved."
        confirmLabel="Clear order"
        destructive
        onConfirm={() => {
          setLines([])
          setDialog(null)
        }}
      />
    </div>
  )
}

function CartPanel({
  lines,
  type,
  locale,
  currency,
  context,
  onContext,
  onQuantity,
  onSend,
  onPay,
  onClear,
}: {
  lines: CartLine[]
  type: OrderType
  locale: string
  currency: string
  context: { table: string; name: string; phone: string; address: string; note: string }
  onContext: (patch: Partial<{ table: string; name: string; phone: string; address: string; note: string }>) => void
  onQuantity: (key: string, quantity: number) => void
  onSend: () => void
  onPay: () => void
  onClear: () => void
}) {
  const uid = useId()
  const empty = lines.length === 0
  return (
    <section aria-labelledby={`${uid}-title`} className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5", SURFACE)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${uid}-title`} className="text-lg font-semibold">
          Current order
        </h2>
        <Button type="button" variant="ghost" size="sm" disabled={empty} onClick={onClear}>
          <Trash2 aria-hidden />
          Clear
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl bg-background/70 p-3 ring-1 ring-border-soft">
        {type === "dine_in" ? (
          <div className="grid gap-1">
            <Label htmlFor={`${uid}-table`} className="text-xs">Table</Label>
            <Input id={`${uid}-table`} value={context.table} onChange={(event) => onContext({ table: event.target.value })} placeholder="For example: Table 5" className="h-10 bg-card" maxLength={30} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor={`${uid}-name`} className="text-xs">Customer name</Label>
              <Input id={`${uid}-name`} value={context.name} onChange={(event) => onContext({ name: event.target.value })} className="h-10 bg-card" maxLength={60} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${uid}-phone`} className="text-xs">Phone</Label>
              <Input id={`${uid}-phone`} type="tel" value={context.phone} onChange={(event) => onContext({ phone: event.target.value })} className="h-10 bg-card" maxLength={20} />
            </div>
          </div>
        )}
        {type === "delivery" ? (
          <div className="grid gap-1">
            <Label htmlFor={`${uid}-address`} className="text-xs">Delivery address</Label>
            <Input id={`${uid}-address`} value={context.address} onChange={(event) => onContext({ address: event.target.value })} className="h-10 bg-card" maxLength={160} />
          </div>
        ) : null}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          {type === "dine_in" ? "Tables aren't connected, so there's no floor plan or occupancy here. The label is only for this screen." : "Customer lookup and saving aren't connected. These details stay on this screen."}
        </p>
      </div>

      {empty ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No items yet. Choose items from the menu.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft" aria-label="Order items">
          {lines.map((line) => (
            <li key={line.key} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{line.name}</p>
                  {line.options.length > 0 ? <p className="text-xs text-muted-foreground">{line.options.join(", ")}</p> : null}
                  {line.note ? <p className="text-xs text-warning-foreground">Note: {line.note}</p> : null}
                </div>
                <span className="text-sm font-bold tabular-nums">{formatMoney(money(lineTotal(line), currency), locale)}</span>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label={`Quantity for ${line.name}`}>
                <Button type="button" variant="outline" size="icon" aria-label={`Remove one ${line.name}`} onClick={() => onQuantity(line.key, line.quantity - 1)}>
                  <Minus aria-hidden />
                </Button>
                <span className="min-w-8 text-center text-base font-bold tabular-nums" aria-live="polite">{line.quantity}</span>
                <Button type="button" variant="outline" size="icon" aria-label={`Add one ${line.name}`} onClick={() => onQuantity(line.key, line.quantity + 1)}>
                  <Plus aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal (estimate)</dt>
          <dd className="tabular-nums">{formatMoney(money(subtotal(lines), currency), locale)}</dd>
        </div>
        <p className="text-xs text-muted-foreground">Discounts, taxes and charges are applied by Foodi when an order is placed, so the total isn&apos;t worked out here.</p>
      </dl>

      <div className="grid gap-2">
        <Button type="button" size="lg" className="h-12" disabled={empty} onClick={onPay}>
          Proceed to payment
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-12" disabled={empty} onClick={onSend}>
          Send to kitchen
        </Button>
      </div>
    </section>
  )
}

function ActiveOrders({ orders, locale }: { orders: OrderDetail[] | null; locale: string }) {
  if (!orders) {
    return <p role="alert" className={cn("rounded-3xl bg-card px-6 py-12 text-center text-sm", SURFACE)}>Active orders couldn&apos;t be loaded. Open the Orders board to try again.</p>
  }
  return (
    <section aria-labelledby="pos-active-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pos-active-title" className="text-lg font-semibold">
          {orders.length} active {orders.length === 1 ? "order" : "orders"}
        </h2>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/orders">Open the Orders board</Link></Button>
          <Button asChild variant="outline"><Link href="/orders/history">Order history</Link></Button>
        </div>
      </div>
      {orders.length === 0 ? (
        <p className={cn("rounded-3xl bg-card px-6 py-12 text-center text-sm text-muted-foreground", SURFACE)}>No active orders.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${encodeURIComponent(order.id)}`} className={cn("flex h-full flex-col gap-2 rounded-2xl bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", SURFACE)}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-mono text-base font-bold">{order.reference}</span>
                  <OrderStatusBadge status={order.status} />
                </span>
                <span className="text-sm text-muted-foreground">
                  {orderTypeLabels[order.orderType]}
                  {order.tableLabel ? ` · ${order.tableLabel}` : ""}
                  {` · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items`}
                </span>
                <span className="mt-auto text-base font-bold tabular-nums">{formatMoney(order.total, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
