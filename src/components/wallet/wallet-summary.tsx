import { Landmark } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ZoneAndLocale } from "@/lib/orders/format"
import type { WalletSummary as WalletSummaryData } from "@/lib/wallet/types"

import { InstantValue, MoneyValue, Unavailable } from "./wallet-values"

/**
 * Named, server-provided amounts, each shown or "Not available". Nothing here
 * is added up or compared, and the panel doesn't say when or how money is paid.
 */
export function WalletSummary({ summary, context }: { summary: WalletSummaryData; context: ZoneAndLocale }) {
  return (
    <section aria-labelledby="wallet-balances-heading" className="flex flex-col gap-3">
      <h2 id="wallet-balances-heading" className="text-base font-semibold">
        Balances
      </h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Figure label="Pending settlement">
          <MoneyValue money={summary.pendingSettlement} locale={context.locale} />
        </Figure>
        <Figure label="Paid out">
          <MoneyValue money={summary.paidOut} locale={context.locale} />
        </Figure>
        <Figure label="On hold">
          <MoneyValue money={summary.onHold} locale={context.locale} />
        </Figure>
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {summary.asOf ? (
          <>
            As of <InstantValue at={summary.asOf} context={context} />.{" "}
          </>
        ) : null}
        Amounts are shown as provided by Foodi&apos;s settlement service. This page doesn&apos;t calculate or verify them.
      </p>
      <Card className="gap-3 rounded-3xl border-transparent py-6 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        <CardHeader>
          <CardTitle>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Landmark aria-hidden className="size-4 text-muted-foreground" />
              Payout destination
            </h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {summary.payoutDestinationLabel === null ? (
            <Unavailable />
          ) : (
            <span className="font-mono text-[0.8125rem]">{summary.payoutDestinationLabel}</span>
          )}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Only a masked label is shown. Account details can&apos;t be seen or changed here.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight">{children}</dd>
    </div>
  )
}
