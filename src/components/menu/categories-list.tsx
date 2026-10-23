import Link from "next/link"
import { ArrowDown, ArrowUp, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MenuCategory } from "@/lib/menu/types"

import { CategoryDialog } from "./category-dialog"

const REORDER_NOTE_ID = "category-reorder-note"

function itemsHref(category: MenuCategory) {
  return `/menu?category=${encodeURIComponent(category.id)}`
}

function ReorderButtons({ category }: { category: MenuCategory }) {
  // aria-disabled keeps them reachable so the reason is announced.
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-disabled="true"
        aria-label={`Move ${category.name} up`}
        aria-describedby={REORDER_NOTE_ID}
        className="cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent"
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-disabled="true"
        aria-label={`Move ${category.name} down`}
        aria-describedby={REORDER_NOTE_ID}
        className="cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent"
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  )
}

function EditButton({ category }: { category: MenuCategory }) {
  return (
    <CategoryDialog
      category={category}
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Edit ${category.name}`}>
          <Pencil aria-hidden />
          Edit
        </Button>
      }
    />
  )
}

/** Categories in display order. Delete and archive are intentionally omitted. */
export function CategoriesList({ categories }: { categories: MenuCategory[] }) {
  const ordered = [...categories].sort((a, b) => a.position - b.position)

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 pl-4">Order</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead>Reorder</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((category, index) => (
              <TableRow key={category.id}>
                <TableCell className="pl-4 tabular-nums text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <p className="font-medium">{category.name}</p>
                  {category.description ? (
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Link
                    href={itemsHref(category)}
                    className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {category.itemCount}
                    <span className="sr-only"> items in {category.name}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <ReorderButtons category={category} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <EditButton category={category} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label="Categories" className="flex flex-col gap-3 md:hidden">
        {ordered.map((category, index) => (
          <li key={category.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                  {category.name}
                </p>
                {category.description ? (
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                ) : null}
              </div>
              <EditButton category={category} />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Link
                href={itemsHref(category)}
                className="rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {category.itemCount} {category.itemCount === 1 ? "item" : "items"}
              </Link>
              <ReorderButtons category={category} />
            </div>
          </li>
        ))}
      </ul>

      <p id={REORDER_NOTE_ID} className="text-xs text-muted-foreground">
        Reordering is shown for planning only. Backend integration pending: the order
        can&apos;t be changed until the menu API is connected.
      </p>
    </div>
  )
}
