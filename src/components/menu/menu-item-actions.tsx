"use client"

import { useState } from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import type { ItemStatus } from "@/lib/menu/rules"
import type { MenuItem } from "@/lib/menu/types"

import { SoldOutDialog } from "./sold-out-dialog"
import { useMenuCommand } from "./use-menu-command"

type Dialog = "sold_out" | "archive" | "delete" | null

/**
 * Row actions: an availability switch (turning off asks how long; turning on
 * is one tap) and a menu for edit, archive, restore and delete. What's allowed
 * is decided by the menu rules on the server, which refuse anything else.
 */
export function MenuItemActions({ item, status }: { item: MenuItem; status: ItemStatus }) {
  const command = useMenuCommand()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [directPending, setDirectPending] = useState(false)
  const open = (next: Dialog) => {
    command.begin()
    setDirectPending(false)
    setDialog(next)
  }
  const runDirect = (run: () => void) => {
    command.begin()
    setDirectPending(true)
    run()
  }
  const close = (next: boolean) => {
    if (!next) setDialog(null)
  }

  const canToggle = status.kind === "available" || status.kind === "sold_out"
  const busy = command.pending && directPending

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {canToggle ? (
          <span className="flex items-center gap-2">
            {busy ? <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" /> : null}
            <Switch
              checked={status.kind === "available"}
              aria-label={`Available: ${item.name}`}
              aria-disabled={busy || undefined}
              onCheckedChange={(checked) => {
                if (busy) return
                if (checked) {
                  runDirect(() => command.run({ type: "set_available", itemId: item.id }, `${item.name} is available again`))
                } else {
                  open("sold_out")
                }
              }}
            />
          </span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`More actions for ${item.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!item.archived ? (
              <DropdownMenuItem asChild>
                <Link href={`/menu/${encodeURIComponent(item.id)}/edit`}>
                  <Pencil aria-hidden />
                  Edit item
                </Link>
              </DropdownMenuItem>
            ) : null}
            {item.archived ? (
              <DropdownMenuItem
                onSelect={() =>
                  runDirect(() => command.run({ type: "restore_item", itemId: item.id }, `${item.name} restored`))
                }
              >
                <ArchiveRestore aria-hidden />
                Restore item
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => open("archive")}>
                <Archive aria-hidden />
                Archive item
              </DropdownMenuItem>
            )}
            {!item.usedOnOrders ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => open("delete")}>
                  <Trash2 aria-hidden />
                  Delete item
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {directPending && command.result && !command.result.ok ? (
        <ActionResultMessage result={command.result} successText="" className="max-w-64 text-left" />
      ) : null}

      {dialog === "sold_out" ? (
        <SoldOutDialog itemId={item.id} itemName={item.name} open onOpenChange={close} command={command} />
      ) : null}
      {dialog === "archive" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Archive ${item.name}?`}
          description="It leaves your menu but keeps its order history. You can restore it later."
          confirmLabel="Archive item"
          pending={command.pending}
          onConfirm={() =>
            command.run({ type: "archive_item", itemId: item.id }, `${item.name} archived`, () => setDialog(null))
          }
        >
          {command.result && !command.result.ok ? <ActionResultMessage result={command.result} successText="" /> : null}
        </ConfirmDialog>
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Delete ${item.name}?`}
          description="It has never been ordered, so it can be deleted for good. This can't be undone."
          confirmLabel="Delete item"
          destructive
          pending={command.pending}
          onConfirm={() =>
            command.run({ type: "delete_item", itemId: item.id }, `${item.name} deleted`, () => setDialog(null))
          }
        >
          {command.result && !command.result.ok ? <ActionResultMessage result={command.result} successText="" /> : null}
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
