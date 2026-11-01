"use client"

import Link from "next/link"
import { Check, ChevronsUpDown, LayoutGrid, Plus, Store } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"

import { useRestaurants } from "../restaurant-context"
import { statusLabel } from "./restaurant-status-badge"

/** Shows the active restaurant and lets the owner switch to another approved one or return to My Restaurants. */
export function RestaurantSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { restaurants, active, select } = useRestaurants()
  const { user } = useAuth()

  // Staff work at one restaurant only: no switcher, just the name of where they are signed in.
  if (user?.role === "staff") {
    return (
      <div className={cn("flex w-full items-center gap-3 rounded-2xl border bg-card p-3", collapsed && "justify-center border-0 bg-transparent p-0")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-soft text-sage-foreground">
          <Store aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        {collapsed ? <span className="sr-only">{active?.name}</span> : <span className="truncate text-sm font-semibold">{active?.name}</span>}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // Expanded, the visible text names the button; a label that differs from it fails WCAG 2.5.3.
        aria-label={collapsed ? `Active restaurant: ${active?.name ?? "none"}. Switch restaurant` : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-xs outline-none transition-[border-color,box-shadow] hover:border-sage-line hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center border-0 bg-transparent p-0 shadow-none"
        )}
      >
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-sage-soft text-sage-foreground">
          <Store aria-hidden className="size-5" strokeWidth={1.75} />
          {active ? (
            <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-sage" />
          ) : null}
        </span>
        {collapsed ? null : (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{active?.name ?? "Select a restaurant"}</span>
              <span className="text-xs text-muted-foreground">{active ? "Switch restaurant" : "None selected"}</span>
            </span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>My restaurants</DropdownMenuLabel>
        {restaurants.map((restaurant) =>
          restaurant.isOperational ? (
            <DropdownMenuItem key={restaurant.id} onSelect={() => select(restaurant.id)}>
              <span className="truncate">{restaurant.name}</span>
              {restaurant.id === active?.id ? <Check aria-hidden className="ml-auto size-4" /> : null}
            </DropdownMenuItem>
          ) : (
            // A pending, rejected or suspended restaurant is never selected; it opens its application status.
            <DropdownMenuItem key={restaurant.id} asChild>
              <Link href={`/restaurants/${restaurant.id}`}>
                <span className="truncate">{restaurant.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{statusLabel(restaurant.status)}</span>
              </Link>
            </DropdownMenuItem>
          )
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/restaurants/new">
            <Plus aria-hidden /> Register another restaurant
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/restaurants">
            <LayoutGrid aria-hidden /> All restaurants
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
