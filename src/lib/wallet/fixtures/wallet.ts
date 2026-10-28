import "server-only"

import { buildFixtureOrders } from "@/lib/orders/fixtures/orders"

import type { Money, SettlementDetail, SettlementOrder, SettlementStatus, WalletSummary } from "../types"

// DEVELOPMENT PREVIEW DATA ONLY. Obviously fictional amounts and periods for
// previewing the UI while the wallet API is built: gross amounts are repeating
// digits (1,111.00, 2,222.00 ...), the payout label is a made-up masked
// pattern, and nothing here is a real balance, bank detail or payout. Only
// src/lib/wallet/preview-source.ts may import this file.
//
// The preview plays the server: every amount below is simply data, and the UI
// never recomputes it. Order rows come from the Orders preview fixtures so each
// links to a sample order that exists. Which settlement "contains" an order
// exists only here: the Orders model has no settlement association.

const CURRENCY = "INR"
const SETTLEMENT_COUNT = 14
/** Settlements 0..12 have orders; the last (index 13) has none, so its breakdown is empty. */
const SETTLEMENTS_WITH_ORDERS = 13
/** Orders from this index on all go to the first settlement, so its breakdown has two pages. */
const FIRST_SETTLEMENT_FROM_ORDER = 30
const DAY = 86_400_000
const WEEK = 7 * DAY

export const PREVIEW_PAYOUT_LABEL = "Preview bank •••• ••00"

const money = (amountMinor: number): Money => ({ amountMinor, currency: CURRENCY })
const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// Index 0 is the newest settlement. 5 has no status, 8 has unavailable amounts.
const STATUSES: (SettlementStatus | null)[] = [
  "pending", "processing", "paid", "paid", "on_hold", null, "paid", "failed", "paid", "paid", "paid", "paid", "paid", "paid",
]

export type PreviewSettlement = SettlementDetail & { orders: SettlementOrder[] }

export function buildFixtureWallet(): WalletSummary {
  return {
    pendingSettlement: money(333300),
    paidOut: money(9999900),
    onHold: null,
    asOf: null,
    payoutDestinationLabel: PREVIEW_PAYOUT_LABEL,
  }
}

/** Built when the preview store starts, so the periods are relative to now. */
export function buildFixtureSettlements(now: number): PreviewSettlement[] {
  const sampleOrders = buildFixtureOrders(now)
  const byIndex = new Map<number, SettlementOrder[]>()

  sampleOrders.forEach((order, index) => {
    const owner = index >= FIRST_SETTLEMENT_FROM_ORDER ? 0 : index % SETTLEMENTS_WITH_ORDERS
    const commission = Math.round(order.total.amountMinor * 0.1)
    const row: SettlementOrder = {
      // One row has no detail page, so it shows no link.
      id: index === 4 ? null : order.id,
      reference: order.reference,
      placedAt: order.placedAt,
      orderTotal: order.total,
      commission: money(-commission),
      net: money(order.total.amountMinor - commission),
      // A pending and a confirmed refund, to show both states.
      refund:
        index === 6
          ? { amount: money(-Math.round(order.total.amountMinor / 2)), status: "pending" }
          : index === 7
            ? { amount: money(-Math.round(order.total.amountMinor / 2)), status: "confirmed" }
            : null,
    }
    byIndex.set(owner, [...(byIndex.get(owner) ?? []), row])
  })

  return Array.from({ length: SETTLEMENT_COUNT }, (_, index) => {
    const end = now - (index * WEEK + DAY)
    const gross = (index + 1) * 111100
    const commission = gross / 10
    const orders = byIndex.get(index) ?? []
    const refundLine = index === 1
      ? [{ kind: "refund" as const, label: "Refund, order PRV-1007", amount: money(-5000), refundStatus: "pending" as const }]
      : index === 2
        ? [{ kind: "refund" as const, label: "Refund, order PRV-1008", amount: money(-5000), refundStatus: "confirmed" as const }]
        : []
    const adjustment = index % 4 === 3 ? [{ kind: "adjustment" as const, label: "Preview goodwill credit", amount: money(2500), refundStatus: null }] : []
    const lines = [
      { kind: "commission" as const, label: "Platform commission", amount: money(-commission), refundStatus: null },
      { kind: "fee" as const, label: "Payment processing fee", amount: money(-1100), refundStatus: null },
      { kind: "tax" as const, label: "Tax on fees", amount: money(-200), refundStatus: null },
      ...adjustment,
      ...refundLine,
    ]
    const net = gross + lines.reduce((sum, line) => sum + line.amount.amountMinor, 0)
    const status = STATUSES[index]
    const unavailable = index === 8
    return {
      id: `prv-set-${String(index + 1).padStart(2, "0")}`,
      periodStart: dateOf(end - 6 * DAY),
      periodEnd: dateOf(end),
      status,
      grossAmount: unavailable ? null : money(gross),
      netAmount: unavailable ? null : money(net),
      orderCount: unavailable ? null : orders.length,
      paidAt: status === "paid" ? new Date(end + 2 * DAY).toISOString() : null,
      lines: unavailable ? [] : lines,
      payoutDestinationLabel: index === 5 ? null : PREVIEW_PAYOUT_LABEL,
      orders,
    }
  })
}
