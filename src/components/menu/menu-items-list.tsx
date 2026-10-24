import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMoney } from "@/lib/orders/format"
import type { MenuItem } from "@/lib/menu/types"

import { AvailabilityBadge } from "./availability-badge"
import { ItemThumbnail } from "./item-thumbnail"
import { MenuItemActions } from "./menu-item-actions"

const editHref = (item: MenuItem) => `/menu/${encodeURIComponent(item.id)}/edit`

function OptionSummary({ item }: { item: MenuItem }) {
  const parts = [
    item.variants.length ? `${item.variants.length} variant${item.variants.length > 1 ? "s" : ""}` : null,
    item.addOns.length ? `${item.addOns.length} add-on${item.addOns.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean)
  return parts.length ? <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span> : null
}

/** Table from md up, cards below. */
export function MenuItemsList({ items }: { items: MenuItem[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <ItemThumbnail imageUrl={item.imageUrl} />
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={editHref(item)}
                        className="w-fit rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {item.name}
                      </Link>
                      <OptionSummary item={item} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.categoryName ?? "Uncategorised"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(item.price)}
                </TableCell>
                <TableCell>
                  <AvailabilityBadge availability={item.availability} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <MenuItemActions
                    itemId={item.id}
                    itemName={item.name}
                    availability={item.availability}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label="Menu items" className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <ItemThumbnail imageUrl={item.imageUrl} className="size-12" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={editHref(item)}
                className="w-fit rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {item.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {item.categoryName ?? "Uncategorised"}
              </span>
              <OptionSummary item={item} />
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold tabular-nums">{formatMoney(item.price)}</span>
                <AvailabilityBadge availability={item.availability} />
              </div>
            </div>
            <MenuItemActions itemId={item.id} itemName={item.name} availability={item.availability} />
          </li>
        ))}
      </ul>
    </>
  )
}
