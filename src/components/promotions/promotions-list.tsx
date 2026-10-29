import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ZoneAndLocale } from "@/lib/orders/format"
import { promotionHref } from "@/lib/promotions/query"
import type { Promotion, PromotionListQuery } from "@/lib/promotions/types"

import { DiscountValue, PromotionStatusBadge, Unavailable, ValidityText } from "./promotion-values"

const Redemptions = ({ promotion }: { promotion: Promotion }) =>
  promotion.redemptionCount === null ? <Unavailable /> : <>{promotion.redemptionCount}</>

/** Table from md up, cards below, both rendered from the same coupons. */
export function PromotionsList({
  promotions,
  query,
  context,
}: {
  promotions: Promotion[]
  /** The list's filter and page, carried to the detail page so "back" returns to the same view. */
  query: PromotionListQuery
  context: ZoneAndLocale
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Coupon</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Valid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Redemptions</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((promotion) => (
              <TableRow key={promotion.id}>
                <TableCell className="pl-4">
                  <span className="font-mono text-[0.8125rem] font-medium">{promotion.code}</span>
                  {promotion.name !== null ? <div className="text-xs text-muted-foreground">{promotion.name}</div> : null}
                </TableCell>
                <TableCell className="font-medium">
                  <DiscountValue discount={promotion.discount} locale={context.locale} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <ValidityText promotion={promotion} context={context} />
                </TableCell>
                <TableCell>
                  <PromotionStatusBadge status={promotion.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Redemptions promotion={promotion} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={promotionHref(promotion.id, query)}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    View<span className="sr-only"> coupon {promotion.code}</span>
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {promotions.map((promotion) => (
          <li key={promotion.id}>
            <Link
              href={promotionHref(promotion.id, query)}
              className="block rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[0.8125rem] font-medium break-all">{promotion.code}</p>
                  {promotion.name !== null ? <p className="text-xs text-muted-foreground">{promotion.name}</p> : null}
                </div>
                <PromotionStatusBadge status={promotion.status} />
              </div>
              <p className="mt-2 text-sm font-medium">
                <DiscountValue discount={promotion.discount} locale={context.locale} />
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Valid</dt>
                  <dd className="text-muted-foreground">
                    <ValidityText promotion={promotion} context={context} />
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Redemptions</dt>
                  <dd className="font-medium tabular-nums">
                    <Redemptions promotion={promotion} />
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
