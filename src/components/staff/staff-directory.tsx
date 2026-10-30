"use client"

import { useId, useState } from "react"
import { Check, Info, Minus, Search, UserPlus, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PERMISSION_AREAS, roleLabels, STAFF_ROLES, STAFF_STATUSES, type StaffData, type StaffMember, type StaffRole, type StaffStatus } from "@/lib/staff"
import { cn } from "@/lib/utils"

const SURFACE = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"

const statusStyle: Record<StaffStatus, { label: string; tone: string }> = {
  active: { label: "Active", tone: "border-success-line bg-success-soft text-success-foreground" },
  inactive: { label: "Inactive", tone: "border-neutral-line bg-neutral-soft text-neutral-foreground" },
  invited: { label: "Invitation pending", tone: "border-warning-line bg-warning-soft text-warning-foreground" },
}

function StatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", statusStyle[status].tone)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {statusStyle[status].label}
    </span>
  )
}

/**
 * Staff directory, role overview and detail panel. Sample data only. The roles and the access they show are
 * a proposal: nothing here changes anyone's access, sends an invitation or saves anything.
 */
export function StaffDirectory({ data }: { data: StaffData }) {
  const [tab, setTab] = useState<"staff" | "roles">("staff")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<StaffRole | "all">("all")
  const [status, setStatus] = useState<StaffStatus | "all">("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [invite, setInvite] = useState(false)
  const shown = data.members.filter(
    (member) =>
      (role === "all" || member.role === role) &&
      (status === "all" || member.status === status) &&
      (search.trim() === "" || member.name.toLowerCase().includes(search.trim().toLowerCase()))
  )
  const open = data.members.find((member) => member.id === openId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Staff views" className={cn("flex w-fit gap-1 rounded-full bg-card p-1", SURFACE)}>
          {([["staff", "Staff"], ["roles", "Roles and access"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                tab === value ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]" : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => setInvite(true)}>
          <UserPlus aria-hidden />
          Invite staff
        </Button>
      </div>

      <p role="note" className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Design only. These roles are proposed and aren&apos;t the real permission model, and nothing on this page changes anyone&apos;s access.
        </span>
      </p>

      {tab === "roles" ? (
        <RoleOverview data={data} />
      ) : (
        <>
          <div className={cn("grid gap-4 rounded-3xl bg-card p-5 sm:grid-cols-3 sm:p-6", SURFACE)}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-search">Name</Label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="staff-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="h-10 bg-background pl-9" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <NativeSelect id="staff-role" value={role} onChange={(event) => setRole(event.target.value as StaffRole | "all")} className="h-10 bg-background">
                <option value="all">All roles</option>
                {STAFF_ROLES.map((value) => (
                  <option key={value} value={value}>{roleLabels[value]}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-status">Status</Label>
              <NativeSelect id="staff-status" value={status} onChange={(event) => setStatus(event.target.value as StaffStatus | "all")} className="h-10 bg-background">
                <option value="all">All statuses</option>
                {STAFF_STATUSES.map((value) => (
                  <option key={value} value={value}>{statusStyle[value].label}</option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className={cn("rounded-3xl bg-card px-6 py-12 text-center text-sm text-muted-foreground", SURFACE)}>No staff match these filters.</p>
          ) : (
            <>
              <div className={cn("hidden overflow-hidden rounded-3xl bg-card lg:block", SURFACE)}>
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="pr-6 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((member) => (
                      <TableRow key={member.id} className="h-[4.25rem]">
                        <TableCell className="pl-6">
                          <span className="flex items-center gap-3 font-semibold">
                            <Avatar />
                            {member.name}
                          </span>
                        </TableCell>
                        <TableCell>{roleLabels[member.role]}</TableCell>
                        <TableCell><StatusBadge status={member.status} /></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{member.contact}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setOpenId(member.id)}>
                            View<span className="sr-only"> {member.name}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                {shown.map((member) => (
                  <li key={member.id}>
                    <button type="button" onClick={() => setOpenId(member.id)} className={cn("flex h-full w-full flex-col gap-3 rounded-2xl bg-card p-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", SURFACE)}>
                      <span className="flex items-center gap-3">
                        <Avatar />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">{member.name}</span>
                          <span className="text-sm text-muted-foreground">{roleLabels[member.role]}</span>
                        </span>
                      </span>
                      <StatusBadge status={member.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {open ? <Detail member={open} data={data} /> : null}
        </SheetContent>
      </Sheet>
      {invite ? <InviteDialog onClose={() => setInvite(false)} /> : null}
    </div>
  )
}

function Avatar() {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
      <UserRound className="size-4" />
    </span>
  )
}

function Detail({ member, data }: { member: StaffMember; data: StaffData }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{member.name}</SheetTitle>
        <SheetDescription>{roleLabels[member.role]}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <StatusBadge status={member.status} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-background/70 p-4 text-sm ring-1 ring-border-soft">
          <dt className="text-muted-foreground">Contact</dt>
          <dd className="font-mono text-xs">{member.contact}</dd>
          <dt className="text-muted-foreground">Last active</dt>
          <dd>{member.lastActive ? new Date(member.lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Hasn't signed in"}</dd>
          {member.invitedAt ? (
            <>
              <dt className="text-muted-foreground">Invited</dt>
              <dd>{new Date(member.invitedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</dd>
            </>
          ) : null}
        </dl>
        <section aria-labelledby="staff-access-title" className="flex flex-col gap-2">
          <h3 id="staff-access-title" className="text-sm font-semibold">Proposed access for this role</h3>
          <ul className="flex flex-wrap gap-1.5">
            {data.access[member.role].map((area) => (
              <li key={area} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-text">{area}</li>
            ))}
          </ul>
        </section>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" disabled>Change role (not connected)</Button>
          <Button type="button" variant="outline" disabled>{member.status === "inactive" ? "Reactivate" : "Deactivate"} (not connected)</Button>
          {member.status === "invited" ? <Button type="button" variant="outline" disabled>Resend invitation (not connected)</Button> : null}
        </div>
      </div>
    </>
  )
}

function RoleOverview({ data }: { data: StaffData }) {
  return (
    <section aria-labelledby="roles-title" className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5 sm:p-6", SURFACE)}>
      <div>
        <h2 id="roles-title" className="text-lg font-semibold">Roles and access</h2>
        <p className="text-sm text-muted-foreground">Which areas each proposed role could use. A check means access; a dash means none.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Proposed access by role</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">Role</th>
              {PERMISSION_AREAS.map((area) => (
                <th key={area} scope="col" className="px-2 py-2 text-center font-medium">{area}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAFF_ROLES.map((role) => (
              <tr key={role} className="border-t border-border-soft">
                <th scope="row" className="py-3 pr-4 text-left font-semibold">{roleLabels[role]}</th>
                {PERMISSION_AREAS.map((area) => {
                  const allowed = data.access[role].includes(area)
                  return (
                    <td key={area} className="px-2 py-3 text-center">
                      {allowed ? <Check aria-hidden className="mx-auto size-4 text-success-foreground" /> : <Minus aria-hidden className="mx-auto size-4 text-muted-foreground" />}
                      <span className="sr-only">{allowed ? "Allowed" : "Not allowed"}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const id = useId()
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite staff</DialogTitle>
          <DialogDescription>Invitations aren&apos;t connected yet, so nothing is sent or saved. This shows how inviting will work.</DialogDescription>
        </DialogHeader>
        <form noValidate className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} className="h-10" autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} type="email" className="h-10" autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-role`}>Role</Label>
            <NativeSelect id={`${id}-role`} className="h-10" defaultValue="waiter">
              {STAFF_ROLES.filter((value) => value !== "owner").map((value) => (
                <option key={value} value={value}>{roleLabels[value]}</option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled>Send invitation (not connected)</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
