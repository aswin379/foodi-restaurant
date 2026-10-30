import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ZoneAndLocale } from "@/lib/orders/format"
import { settlementHref } from "@/lib/wallet/query"
import type { SettlementSummary } from "@/lib/wallet/types"

import { MoneyValue, PeriodText, SettlementStatusBadge, Unavailable } from "./wallet-values"

const periodLabel = (settlement: SettlementSummary) => `${settlement.periodStart} to ${settlement.periodEnd}`

/** Table from md up, cards below, both rendered from the same settlements. */
export function SettlementsList({
  settlements,
  listPage,
  context,
}: {
  settlements: SettlementSummary[]
  /** The list page shown, carried to the detail page so "back" returns to it. */
  listPage: number
  context: ZoneAndLocale
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)] lg:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((settlement) => (
              <TableRow key={settlement.id}>
                <TableCell className="pl-4 font-medium">
                  <PeriodText settlement={settlement} locale={context.locale} />
                </TableCell>
                <TableCell>
                  <SettlementStatusBadge status={settlement.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {settlement.orderCount === null ? <Unavailable /> : settlement.orderCount}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyValue money={settlement.grossAmount} locale={context.locale} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  <MoneyValue money={settlement.netAmount} locale={context.locale} />
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Link
                    href={settlementHref(settlement.id, listPage)}
                    className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    View<span className="sr-only"> settlement {periodLabel(settlement)}</span>
                    <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary-soft"><ArrowRight className="size-3.5" /></span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
        {settlements.map((settlement) => (
          <li key={settlement.id}>
            <Link
              href={settlementHref(settlement.id, listPage)}
              className="block h-full rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)] outline-none transition-shadow hover:shadow-[0_12px_36px_rgb(214_63_8/16%)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  <PeriodText settlement={settlement} locale={context.locale} />
                </p>
                <SettlementStatusBadge status={settlement.status} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                <Metric label="Orders">{settlement.orderCount === null ? <Unavailable /> : settlement.orderCount}</Metric>
                <Metric label="Gross">
                  <MoneyValue money={settlement.grossAmount} locale={context.locale} />
                </Metric>
                <Metric label="Net">
                  <MoneyValue money={settlement.netAmount} locale={context.locale} />
                </Metric>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}
