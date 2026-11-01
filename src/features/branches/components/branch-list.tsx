"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleAlert, GitBranch, Pencil, Plus } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { notify } from "@/components/shared/notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

import { listBranches, updateBranch } from "../branch-service"
import type { Branch } from "../types"
import { BranchForm } from "./branch-form"

type Editing = { branch?: Branch } | null

/** `embedded` shows it as a section of another page (the restaurant profile) instead of a full page. */
export function BranchList({ embedded = false }: { embedded?: boolean }) {
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setBranches(await listBranches())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your branches.")
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load()
  }, [load])

  async function toggleActive(branch: Branch) {
    if (busyId !== null) return
    setBusyId(branch.id)
    try {
      await updateBranch(branch.id, { isActive: !branch.isActive })
      notify({
        kind: "success",
        title: branch.isActive ? "Branch disabled" : "Branch enabled",
        preview: false,
      })
      await load()
    } catch (e) {
      notify({
        kind: "error",
        title: "Nothing was changed",
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleSaved(saved: Branch) {
    const wasEdit = editing?.branch !== undefined
    setEditing(null)
    notify({ kind: "success", title: wasEdit ? "Branch updated" : "Branch added", description: saved.name, preview: false })
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Manage branches</h2>
            <p className="text-sm text-muted-foreground">The locations of this restaurant.</p>
          </div>
          <Button onClick={() => setEditing({})}>
            <Plus aria-hidden />
            Add branch
          </Button>
        </div>
      ) : (
        <PageHeader
          title="Branches"
          description="The locations of your restaurant."
          actions={
            <Button onClick={() => setEditing({})}>
              <Plus aria-hidden />
              Add branch
            </Button>
          }
        />
      )}

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
      ) : branches === null ? (
        <div role="status" aria-label="Loading branches" className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <GitBranch aria-hidden className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">No branches yet</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Add your first branch to get started.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {branches.map((branch) => (
            <li
              key={branch.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-card px-5 py-4 shadow-[0_8px_30px_rgb(31_26_23/6%)]"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="truncate">{branch.name}</span>
                  {branch.isMain ? <Badge variant="secondary">Main</Badge> : null}
                  <Badge variant={branch.isActive ? "secondary" : "outline"}>
                    {branch.isActive ? "Active" : "Disabled"}
                  </Badge>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {branch.tableCount} {branch.tableCount === 1 ? "table" : "tables"} ·{" "}
                  {branch.roomCount} {branch.roomCount === 1 ? "room" : "rooms"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch
                  checked={branch.isActive}
                  disabled={branch.isMain || busyId !== null}
                  onCheckedChange={() => void toggleActive(branch)}
                  aria-label={`${branch.name} is active`}
                />
                Active
              </label>
              <Button variant="outline" size="sm" onClick={() => setEditing({ branch })}>
                <Pencil aria-hidden />
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.branch ? "Edit branch" : "Add branch"}</DialogTitle>
            <DialogDescription>
              {editing?.branch ? "Change the name of this branch." : "Name the new branch."}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <BranchForm
              branch={editing.branch}
              onSaved={(saved) => void handleSaved(saved)}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
