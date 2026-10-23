"use client"

import Link from "next/link"
import { MoreHorizontal, Pencil, ToggleLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MenuAvailability } from "@/lib/menu/types"

export function MenuItemActions({
  itemId,
  itemName,
  availability,
}: {
  itemId: string
  itemName: string
  availability: MenuAvailability
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${itemName}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <Link href={`/menu/${encodeURIComponent(itemId)}/edit`}>
            <Pencil aria-hidden />
            Edit item
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <ToggleLeft aria-hidden />
          {availability === "available" ? "Mark unavailable" : "Mark available"}
        </DropdownMenuItem>
        <DropdownMenuLabel className="text-xs font-normal leading-relaxed text-muted-foreground">
          Changing availability needs the menu API. Backend integration pending.
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
