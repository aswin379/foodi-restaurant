"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleAlert, Eye, KeyRound, MoreHorizontal, Pencil, Plus, Search, UserCheck, UserX, Users } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { notify } from "@/components/shared/notifications"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/auth-context"

import { PAGE_SIZE, getStaffMeta, listStaff, setStaffStatus } from "../staff-service"
import type { StaffListQuery, StaffMember, StaffMeta, StaffPage } from "../types"
import { StaffForm } from "./staff-form"
import { StaffPasswordDialog } from "./staff-password-dialog"

const ALL = "all"
const INITIAL_QUERY: StaffListQuery = { q: "", sellerId: "", designationId: "", status: "", sort: "createdAt", order: "desc", page: 1 }

type Editing = { staff?: StaffMember } | null

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function StaffManager() {
  const { user } = useAuth()
  const [meta, setMeta] = useState<StaffMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounced(search)
  const [data, setData] = useState<StaffPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [viewing, setViewing] = useState<StaffMember | null>(null)
  const [resetting, setResetting] = useState<StaffMember | null>(null)
  const [toggling, setToggling] = useState<StaffMember | null>(null)
  const [togglePending, setTogglePending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const isOwner = user?.role !== "staff"
  const effective: StaffListQuery = { ...query, q: debouncedSearch }

  useEffect(() => {
    if (!isOwner) return
    let alive = true
    getStaffMeta()
      .then((m) => alive && setMeta(m))
      .catch((e: unknown) => alive && setMetaError(e instanceof Error ? e.message : "Could not load staff options."))
    return () => {
      alive = false
    }
  }, [isOwner, reloadKey])

  const { q, sellerId, designationId, status, sort, order, page } = effective
  useEffect(() => {
    if (!isOwner) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start loading before the request
    setError(null)
    listStaff({ q, sellerId, designationId, status, sort, order, page })
      .then((result) => {
        if (!alive) return
        // The last page can disappear (e.g. after a filter); go back to the first one.
        if (result.items.length === 0 && result.total > 0 && page > 1) setQuery((c) => ({ ...c, page: 1 }))
        else setData(result)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load your staff."))
    return () => {
      alive = false
    }
  }, [isOwner, q, sellerId, designationId, status, sort, order, page, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  function update(changes: Partial<StaffListQuery>) {
    setQuery((current) => ({ ...current, page: 1, ...changes }))
  }

  async function confirmToggle() {
    if (!toggling || togglePending) return
    setTogglePending(true)
    setToggleError(null)
    try {
      const next = toggling.status === "active" ? "inactive" : "active"
      await setStaffStatus(toggling.id, next)
      notify({ kind: "success", title: next === "active" ? "Account activated" : "Account deactivated", description: toggling.name, preview: false })
      setToggling(null)
      reload()
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : "Nothing was changed.")
    } finally {
      setTogglePending(false)
    }
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Staff & roles" />
        <p role="alert" className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Only the restaurant owner can manage staff.
        </p>
      </div>
    )
  }

  const multiRestaurant = (meta?.restaurants.length ?? 0) > 1
  const hasFilters = Boolean(search || query.sellerId || query.designationId || query.status)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff & roles"
        description="Add the people who work at your restaurant and choose exactly what each of them can do."
        actions={
          <Button onClick={() => setEditing({})} disabled={!meta}>
            <Plus aria-hidden />
            Add staff
          </Button>
        }
      />

      <div role="search" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search staff by name, email or mobile"
            placeholder="Search name, email or mobile"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setQuery((c) => ({ ...c, page: 1 }))
            }}
            className="h-10 rounded-xl bg-white pl-9 shadow-none"
          />
        </div>
        {multiRestaurant ? (
          <FilterSelect
            label="Restaurant"
            allText="All restaurants"
            value={query.sellerId}
            onChange={(v) => update({ sellerId: v })}
            options={(meta?.restaurants ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
          />
        ) : null}
        <FilterSelect
          label="Designation"
          allText="All designations"
          value={query.designationId}
          onChange={(v) => update({ designationId: v })}
          options={(meta?.designations ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
        />
        <FilterSelect
          label="Status"
          allText="All statuses"
          value={query.status}
          onChange={(v) => update({ status: v as StaffListQuery["status"] })}
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
        <FilterSelect
          label="Sort by"
          allText={null}
          value={`${query.sort}:${query.order}`}
          onChange={(v) => {
            const [sort, order] = v.split(":") as [StaffListQuery["sort"], StaffListQuery["order"]]
            update({ sort, order })
          }}
          options={[
            { value: "createdAt:desc", label: "Newest first" },
            { value: "createdAt:asc", label: "Oldest first" },
            { value: "name:asc", label: "Name A–Z" },
            { value: "name:desc", label: "Name Z–A" },
            { value: "designation:asc", label: "Designation A–Z" },
          ]}
        />
      </div>

      {error || metaError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-4 text-sm text-danger-foreground">
          <p className="flex items-center gap-2">
            <CircleAlert aria-hidden className="size-4" />
            {error ?? metaError}
          </p>
          <Button variant="outline" size="sm" onClick={() => { setMetaError(null); reload() }}>
            Try again
          </Button>
        </div>
      ) : data === null ? (
        <div role="status" aria-label="Loading staff" className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      ) : data.total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users aria-hidden className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">{hasFilters ? "No staff match these filters" : "No staff yet"}</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            {hasFilters ? "Try a different search or clear the filters." : "Add the first person who works at your restaurant."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  {multiRestaurant ? <TableHead>Restaurant</TableHead> : null}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{member.designation.name}</Badge>
                    </TableCell>
                    {multiRestaurant ? <TableCell>{member.restaurant.name}</TableCell> : null}
                    <TableCell>
                      <Badge variant={member.status === "active" ? "success" : "outline"}>
                        {member.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${member.name}`}>
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setViewing(member)}>
                            <Eye aria-hidden /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditing({ staff: member })}>
                            <Pencil aria-hidden /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setResetting(member)}>
                            <KeyRound aria-hidden /> Reset password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => { setToggleError(null); setToggling(member) }}>
                            {member.status === "active" ? (
                              <>
                                <UserX aria-hidden /> Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck aria-hidden /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <nav aria-label="Staff pages" className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Page {data.page} of {totalPages} · {data.total} {data.total === 1 ? "person" : "people"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setQuery((c) => ({ ...c, page: c.page - 1 }))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={data.page >= totalPages} onClick={() => setQuery((c) => ({ ...c, page: c.page + 1 }))}>
                Next
              </Button>
            </div>
          </nav>
        </>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-xl">
          <SheetHeader className="p-0">
            <SheetTitle>{editing?.staff ? "Edit staff member" : "Add staff member"}</SheetTitle>
            <SheetDescription>
              {editing?.staff ? "Change their details, designation and what they can do." : "They sign in with their email and the temporary password you set."}
            </SheetDescription>
          </SheetHeader>
          {editing && meta ? (
            <StaffForm
              key={editing.staff?.id ?? "new"}
              meta={meta}
              staff={editing.staff}
              onCancel={() => setEditing(null)}
              onSaved={(saved) => {
                notify({ kind: "success", title: editing.staff ? "Staff member updated" : "Staff member added", description: saved.name, preview: false })
                setEditing(null)
                reload()
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.name}</DialogTitle>
                <DialogDescription>{viewing.email}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Restaurant</dt>
                <dd>{viewing.restaurant.name}</dd>
                <dt className="text-muted-foreground">Designation</dt>
                <dd>{viewing.designation.name}</dd>
                <dt className="text-muted-foreground">Mobile</dt>
                <dd>{viewing.mobile ?? "—"}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{viewing.status === "active" ? "Active" : "Inactive"}</dd>
                <dt className="text-muted-foreground">Can do</dt>
                <dd>
                  {viewing.permissions.length === 0
                    ? "Nothing yet"
                    : (meta?.permissionGroups ?? [])
                        .flatMap((g) => g.permissions)
                        .filter((p) => viewing.permissions.includes(p.key))
                        .map((p) => p.label)
                        .join(", ")}
                </dd>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <StaffPasswordDialog
        staff={resetting}
        onClose={() => setResetting(null)}
        onDone={(member) => {
          notify({ kind: "success", title: "Password reset", description: member.name, preview: false })
          setResetting(null)
        }}
      />

      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.status === "active" ? "Deactivate this account?" : "Activate this account?"}
        description={
          toggling?.status === "active"
            ? `${toggling.name} will be signed out and will not be able to sign in until you activate the account again.`
            : `${toggling?.name ?? "This person"} will be able to sign in again with their current password.`
        }
        confirmLabel={toggling?.status === "active" ? "Deactivate" : "Activate"}
        destructive={toggling?.status === "active"}
        pending={togglePending}
        onConfirm={() => void confirmToggle()}
      >
        {toggleError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {toggleError}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allText,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  /** Text for the "no filter" choice; null when the control always has a value (sorting). */
  allText: string | null
}) {
  return (
    <Select value={value || (allText === null ? undefined : ALL)} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label={label} className="h-10 w-full rounded-xl bg-white sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allText === null ? null : <SelectItem value={ALL}>{allText}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
