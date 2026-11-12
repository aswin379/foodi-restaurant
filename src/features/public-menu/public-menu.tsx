"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { API_BASE_URL } from "@/lib/api/base-url"

// A minimal public landing page for a scanned QR code. It only shows the restaurant, the live menu and, for a table
// QR, which table it is. Cart, login and ordering belong to the customer site later; "Place Order" is not wired yet.

type Entry = {
  seller: { id: number; name: string; slug: string | null }
  locationStatus: "NONE" | "OK" | "INVALID" | "DISABLED"
  message: string | null
  location: { type: "TABLE" | "ROOM" | "SEAT"; label: string; group: string | null } | null
  isSingleQr: boolean
}

type Profile = { description: string | null; address: string | null }

type Food = {
  id: number
  name: string
  description: string | null
  category: { id: number; name: string }
  price: number
  discount: number
  discountType: "percent" | "amount"
  isVeg: boolean
}

const PLACE_WORD = { TABLE: "Table", ROOM: "Room", SEAT: "Seat" } as const

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null
  if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Something went wrong")
  return body.data
}

function finalPrice(food: Food): number {
  if (!food.discount) return food.price
  const off = food.discountType === "percent" ? (food.price * food.discount) / 100 : food.discount
  return Math.max(0, Math.round((food.price - off) * 100) / 100)
}

const rupees = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; entry: Entry; profile: Profile | null; foods: Food[] }

export function PublicMenu({ slug, loc }: { slug?: string; loc?: string }) {
  const [state, setState] = useState<State>({ phase: "loading" })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const query = new URLSearchParams()
        if (slug) query.set("slug", slug)
        if (loc) query.set("loc", loc)
        const entry = await api<Entry>(`/customer/qr/entry?${query.toString()}`)
        // The menu is always read live; the QR code carries no menu data.
        const [menu, profile] = await Promise.all([
          api<{ foods: Food[] }>(`/customer/sellers/${entry.seller.id}/foods`),
          api<Profile>(`/customer/sellers/${entry.seller.id}`).catch(() => null),
        ])
        if (!cancelled) setState({ phase: "ready", entry, profile, foods: menu.foods })
      } catch (error) {
        if (!cancelled) setState({ phase: "error", message: error instanceof Error ? error.message : "Something went wrong" })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug, loc])

  if (state.phase === "loading") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    )
  }
  if (state.phase === "error") {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-xl font-semibold">This menu is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </main>
    )
  }

  const { entry, profile, foods } = state
  const where = entry.location ? `${PLACE_WORD[entry.location.type]} ${entry.location.label}` : null
  const byCategory = new Map<string, Food[]>()
  for (const food of foods) byCategory.set(food.category.name, [...(byCategory.get(food.category.name) ?? []), food])

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-4 pb-28">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{entry.seller.name}</h1>
        {profile?.address ? <p className="text-sm text-muted-foreground">{profile.address}</p> : null}
        {profile?.description ? <p className="text-sm">{profile.description}</p> : null}
      </header>

      {where ? (
        <div role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-lg font-semibold text-primary">
          {where}
        </div>
      ) : null}
      {entry.message ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {entry.message}. You can still look at the menu.
        </div>
      ) : null}

      {foods.length === 0 ? <p className="text-sm text-muted-foreground">No items are available right now.</p> : null}
      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{category}</h2>
          <ul className="flex flex-col divide-y rounded-xl border">
            {items.map((food) => (
              <li key={food.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span role="img" aria-label={food.isVeg ? "Veg" : "Non-veg"} className={food.isVeg ? "text-green-600" : "text-red-600"}>
                      ●{" "}
                    </span>
                    {food.name}
                  </p>
                  {food.description ? <p className="text-sm text-muted-foreground">{food.description}</p> : null}
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-semibold">{rupees(finalPrice(food))}</p>
                  {food.discount ? <p className="text-xs text-muted-foreground line-through">{rupees(food.price)}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {where ? <Badge variant="secondary">{where}</Badge> : null}
          <Button className="flex-1" size="lg" disabled title="Ordering from this page is coming soon">
            Place Order (coming soon)
          </Button>
        </div>
      </div>
    </main>
  )
}
