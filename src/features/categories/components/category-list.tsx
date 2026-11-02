"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Pencil, Plus, Search, Tags } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { notify } from "@/components/shared/notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

import { listCategories, setCategoryStatus } from "../category-service"
import type { Category } from "../types"
import { CategoryFormDialog } from "./category-form-dialog"

export function CategoryList() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await listCategories()
      setCategories(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load categories from the server.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
    )
  }, [categories, search])

  async function handleToggleStatus(category: Category) {
    if (busyId !== null) return
    setBusyId(category.id)
    const nextStatus = !category.isActive
    try {
      await setCategoryStatus(category.id, nextStatus)
      notify({
        kind: "success",
        title: nextStatus ? `Category "${category.name}" enabled` : `Category "${category.name}" disabled`,
        preview: false,
      })
      setCategories((prev) =>
        prev ? prev.map((c) => (c.id === category.id ? { ...c, isActive: nextStatus } : c)) : null
      )
    } catch (e) {
      notify({
        kind: "error",
        title: "Could not change category status",
        description: e instanceof Error ? e.message : "Something went wrong.",
      })
    } finally {
      setBusyId(null)
    }
  }

  function handleOpenCreate() {
    setEditingCategory(null)
    setDialogOpen(true)
  }

  function handleOpenEdit(category: Category) {
    setEditingCategory(category)
    setDialogOpen(true)
  }

  function handleSaved() {
    void load()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Categories"
        description="Categories group your food items, like Starters, Main Course, or Desserts."
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus aria-hidden className="mr-1.5 size-4" />
            Add category
          </Button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle aria-hidden className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="relative max-w-sm">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm border border-border/50">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3.5 w-72" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : categories && categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Every menu item needs a category. Add your first category using the button above."
          className="min-h-72 rounded-3xl border-border bg-card"
        />
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No categories found matching &quot;{search}&quot;.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredCategories.map((category) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm border border-border/50 sm:flex-row sm:items-center sm:justify-between sm:px-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-foreground text-base">{category.name}</span>
                  {!category.isActive ? (
                    <Badge variant="secondary" className="text-xs">
                      Off
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {category.foodCount} {category.foodCount === 1 ? "food" : "foods"}
                  </Badge>
                </div>
                {category.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={category.isActive}
                    disabled={busyId === category.id}
                    onCheckedChange={() => void handleToggleStatus(category)}
                    aria-label={`Toggle active for ${category.name}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => handleOpenEdit(category)}
                  aria-label={`Edit ${category.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        onSaved={handleSaved}
      />
    </div>
  )
}

