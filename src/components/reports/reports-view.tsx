"use client"

import { useState } from "react"
import { Ban, Download, IndianRupee, Info, ReceiptText, TrendingUp, Undo2, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/orders/format"
import { REPORT_RANGES, rangeLabels, type ReportRange, type ReportSlice, type ReportsData } from "@/lib/reports"
import { cn } from "@/lib/utils"

const SURFACE = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"
const CURRENCY = "INR"
const money = (amountMinor: number, locale: string) => formatMoney({ amountMinor, currency: CURRENCY }, locale)

/**
 * Sales overview, trends and breakdowns. Every figure comes from the report data it is given (preview
 * samples here, labelled by the page); nothing is worked out from orders in the browser, and export isn't
 * connected. Charts have a text equivalent for screen readers.
 */
export function ReportsView({ data, locale }: { data: ReportsData; locale: string }) {
  const [range, setRange] = useState<ReportRange>("7d")
  const report = data[range]
  const average = report.orders > 0 ? Math.round(report.salesMinor / report.orders) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Date range" className={cn("flex w-fit flex-wrap gap-1 rounded-full bg-card p-1", SURFACE)}>
          {REPORT_RANGES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                range === value ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]" : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              {rangeLabels[value]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled>
            <Download aria-hidden />
            Export CSV (not connected)
          </Button>
          <Button type="button" variant="outline" disabled>
            Export PDF (not connected)
          </Button>
        </div>
      </div>

      <ul aria-label="Key figures" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={IndianRupee} label="Sales" value={money(report.salesMinor, locale)} />
        <Kpi icon={ReceiptText} label="Orders" value={String(report.orders)} />
        <Kpi icon={TrendingUp} label="Average order" value={average === null ? "—" : money(average, locale)} />
        <Kpi icon={Ban} label="Cancelled orders" value={String(report.cancelledOrders)} />
      </ul>

      <Card title={`Sales trend, ${report.trendUnit === "hour" ? "by hour" : "by day"}`} description={rangeLabels[range]}>
        <BarChart slices={report.trend} locale={locale} unit={report.trendUnit} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Best-selling items" description="By quantity sold">
          <ol className="flex flex-col gap-2">
            {report.bestSellers.map((item, index) => (
              <li key={item.name} className="flex items-center gap-3 rounded-2xl bg-background/70 p-3 ring-1 ring-border-soft">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">{index + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{item.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{item.quantity} sold</span>
                <span className="text-sm font-bold tabular-nums">{money(item.salesMinor, locale)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Category performance" description="Share of sales">
          <Breakdown slices={report.categories} locale={locale} />
        </Card>
        <Card title="Order types" description="Share of sales">
          <Breakdown slices={report.orderTypes} locale={locale} />
        </Card>
        <Card title="Payment methods" description="Share of sales">
          <Breakdown slices={report.payments} locale={locale} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Refunds and cancellations" description={rangeLabels[range]}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-background/70 p-4 text-sm ring-1 ring-border-soft">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><Ban aria-hidden className="size-4" />Cancelled orders</dt>
            <dd className="text-right font-semibold tabular-nums">{report.cancelledOrders}</dd>
            <dt className="flex items-center gap-1.5 text-muted-foreground"><Undo2 aria-hidden className="size-4" />Refunded</dt>
            <dd className="text-right font-semibold tabular-nums">{money(report.refundedMinor, locale)}</dd>
          </dl>
        </Card>
        <Card title="Settlement summary" description="From the settlement service, shown as given">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-background/70 p-4 text-sm ring-1 ring-border-soft">
            <dt className="text-muted-foreground">Pending settlement</dt>
            <dd className="text-right font-semibold tabular-nums">{money(report.settlement.pendingMinor, locale)}</dd>
            <dt className="text-muted-foreground">Paid out</dt>
            <dd className="text-right font-semibold tabular-nums">{money(report.settlement.paidOutMinor, locale)}</dd>
          </dl>
        </Card>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-px size-3.5 shrink-0" />
        Sample figures for review. A reports service isn&apos;t connected, so no real sales, orders or payouts are shown.
      </p>
    </div>
  )
}

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-3xl bg-card p-4 sm:p-5", SURFACE)}>
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/30%)]">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</span>
      </span>
    </li>
  )
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5 sm:p-6", SURFACE)} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">Sample data</span>
      </div>
      {children}
    </section>
  )
}

/** Bars drawn as SVG, with the same figures as text below for screen readers. */
function BarChart({ slices, locale, unit }: { slices: ReportSlice[]; locale: string; unit: "hour" | "day" }) {
  const max = Math.max(1, ...slices.map((slice) => slice.value))
  const peak = slices.reduce((best, slice) => (slice.value > best.value ? slice : best), slices[0])
  const W = 600
  const H = 180
  const gap = 3
  const bar = (W - gap * (slices.length - 1)) / slices.length
  return (
    <figure className="flex flex-col gap-2">
      <svg role="img" aria-label={`Sales ${unit === "hour" ? "by hour" : "by day"}. Highest: ${peak.label}, ${money(peak.value, locale)}.`} viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        {slices.map((slice, index) => {
          const height = Math.max(slice.value > 0 ? 2 : 0, (slice.value / max) * (H - 6))
          return <rect key={slice.label} x={index * (bar + gap)} y={H - height} width={bar} height={height} rx={Math.min(4, bar / 2)} className={slice === peak ? "fill-primary" : "fill-brand-orange/55"} />
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{slices[0]?.label}</span>
        <span>{slices[slices.length - 1]?.label}</span>
      </div>
      <figcaption className="sr-only">
        <ul>
          {slices.map((slice) => (
            <li key={slice.label}>
              {slice.label}: {money(slice.value, locale)}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

function Breakdown({ slices, locale }: { slices: ReportSlice[]; locale: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1
  return (
    <ul className="flex flex-col gap-3">
      {slices.map((slice) => {
        const percent = Math.round((slice.value / total) * 100)
        return (
          <li key={slice.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{slice.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {percent}% · {money(slice.value, locale)}
              </span>
            </div>
            <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-primary-soft">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
