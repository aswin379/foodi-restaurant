import { AlertTriangle, CheckCircle2, CircleAlert, Inbox, Info, PackageCheck } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { orderStatusTones } from "@/lib/design/tokens"

const variants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const
const sizes = [
  { size: "sm", label: "Small 32px" },
  { size: "default", label: "Default 40px" },
  { size: "lg", label: "Large 44px" },
] as const

export function ButtonGallery() {
  return (
    <div className="flex flex-col gap-6">
      {sizes.map(({ size, label }) => (
        <div key={size} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{label}</h3>
          <div className="flex flex-wrap items-center gap-3">
            {variants.map((variant) => (
              <Button key={variant} variant={variant} size={size}>
                {variant === "default" ? "Primary" : variant[0].toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Disabled</h3>
        <div className="flex flex-wrap items-center gap-3">
          {variants.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {variant === "default" ? "Primary" : variant[0].toUpperCase() + variant.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

const badgeVariants = ["default", "secondary", "outline", "success", "warning", "info", "danger", "neutral", "violet", "cyan"] as const

export function BadgeGallery() {
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-2">
        {badgeVariants.map((variant) => (
          <li key={variant}>
            <Badge variant={variant}>{variant}</Badge>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Order statuses (the existing Orders mapping, now from tokens)</h3>
        <ul className="flex flex-wrap gap-2">
          {orderStatusTones.map(({ status, tone }) => (
            <li key={status}>
              <Badge variant={tone}>{status}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const notices = [
  { tone: "info", Icon: Info, text: "An informational notice, in the info tone.", className: "border-info-line bg-info-soft text-info-foreground" },
  { tone: "success", Icon: CheckCircle2, text: "A success notice, in the success tone.", className: "border-success-line bg-success-soft text-success-foreground" },
  { tone: "warning", Icon: AlertTriangle, text: "A warning or preview notice, in the warning tone.", className: "border-warning-line bg-warning-soft text-warning-foreground" },
  { tone: "danger", Icon: CircleAlert, text: "An error notice, in the danger tone.", className: "border-danger-line bg-danger-soft text-danger-foreground" },
] as const

export function FormGallery() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ds-text">Text field</Label>
          <Input id="ds-text" placeholder="Placeholder text" />
          <p className="text-xs text-muted-foreground">Control borders are 3:1. Press Tab to see the focus ring.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ds-invalid">Invalid field</Label>
          <Input id="ds-invalid" aria-invalid defaultValue="Sample value" aria-describedby="ds-invalid-help" />
          <p id="ds-invalid-help" className="text-xs text-destructive">
            This is how an error message reads.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ds-disabled">Disabled field</Label>
          <Input id="ds-disabled" disabled defaultValue="Disabled value" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ds-select">Select</Label>
          <NativeSelect id="ds-select" defaultValue="one">
            <option value="one">First option</option>
            <option value="two">Second option</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ds-textarea">Text area</Label>
          <Textarea id="ds-textarea" placeholder="A longer note" />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Checkbox id="ds-check-off" />
          <Label htmlFor="ds-check-off">Checkbox, off</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="ds-check-on" defaultChecked />
          <Label htmlFor="ds-check-on">Checkbox, on</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ds-switch-off" />
          <Label htmlFor="ds-switch-off">Switch, off</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ds-switch-on" defaultChecked />
          <Label htmlFor="ds-switch-on">Switch, on</Label>
        </div>
        <RadioGroup defaultValue="b" aria-label="Sample radio group" className="gap-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="a" id="ds-radio-a" />
            <Label htmlFor="ds-radio-a">Radio option A</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="b" id="ds-radio-b" />
            <Label htmlFor="ds-radio-b">Radio option B</Label>
          </div>
        </RadioGroup>
        <Tabs defaultValue="one">
          <TabsList aria-label="Sample tabs">
            <TabsTrigger value="one">First</TabsTrigger>
            <TabsTrigger value="two">Second</TabsTrigger>
            <TabsTrigger value="three">Third</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="pt-2 text-sm text-muted-foreground">
            The active tab is a white pill with brand-coloured text.
          </TabsContent>
          <TabsContent value="two" className="pt-2 text-sm text-muted-foreground">
            Second tab content.
          </TabsContent>
          <TabsContent value="three" className="pt-2 text-sm text-muted-foreground">
            Third tab content.
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export function SurfaceGallery() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1111, 2222, 3333].map((value, index) => (
          <Card key={value} className="gap-3 py-5">
            <CardContent className="flex items-center gap-4 px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
                <PackageCheck aria-hidden className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-xs text-muted-foreground">Sample metric {index + 1}</span>
                <span className="text-[1.75rem] leading-8 font-bold tabular-nums">{value.toLocaleString("en-IN")}</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3 className="text-base font-semibold">Card with a table</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Sample item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "Sample row one", status: "success", label: "Ready", amount: "1,111.00" },
                { name: "Sample row two", status: "warning", label: "Pending", amount: "2,222.00" },
                { name: "Sample row three", status: "danger", label: "Cancelled", amount: "3,333.00" },
              ].map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="pl-6 font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant={row.status as "success" | "warning" | "danger"}>{row.label}</Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {notices.map(({ tone, Icon, text, className }) => (
          <div key={tone} role="note" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${className}`}>
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p className="leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState icon={Inbox} title="Empty state" description="Empty states use a tinted circle and a short explanation." className="min-h-48 bg-card" />
        <div role="status" aria-label="Sample loading placeholder" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  )
}
