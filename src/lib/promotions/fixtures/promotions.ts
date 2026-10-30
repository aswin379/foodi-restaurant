import "server-only"

import type { Promotion, PromotionStatus } from "../types"

// DEVELOPMENT PREVIEW DATA ONLY. Obviously fictional coupons for previewing
// the UI while the promotions API is built. Every code starts with "PREVIEW-",
// the amounts and rates are repeating digits (11.11, 22.22, 12.34 percent),
// and nothing here is a real coupon, price or rule. Which coupon is funded or
// managed by whom, and which components it applies to, exist only in this
// fixture. Only src/lib/promotions/preview-source.ts may import this file.

const CURRENCY = "INR"
const DAY = 86_400_000
const money = (amountMinor: number) => ({ amountMinor, currency: CURRENCY })

type Row = Partial<Promotion> & Pick<Promotion, "code" | "discount"> & { status: PromotionStatus | null; startOffsetDays: number | null; lengthDays: number | null }

// Listed in this order. Index 5 reports no status, 7 is a bare coupon (nothing optional),
// and 8 has real zeros. Statuses are just labels: they aren't worked out from the dates.
const ROWS: Row[] = [
  {
    code: "PREVIEW-SOON11",
    status: "scheduled",
    startOffsetDays: 5,
    lengthDays: 30,
    discount: { type: "percentage", rateBasisPoints: 1111, maxDiscount: money(5555) },
    minimumOrder: money(11100),
    orderTypes: ["delivery", "takeaway"],
    appliesTo: ["subtotal"],
    fundedBy: "restaurant",
    managedBy: "restaurant",
    stackable: false,
    usageLimit: 1111,
    perCustomerLimit: 1,
    redemptionCount: 0,
  },
  {
    code: "PREVIEW-LIVE12",
    name: "Preview percentage coupon",
    status: "active",
    startOffsetDays: -10,
    lengthDays: 40,
    discount: { type: "percentage", rateBasisPoints: 1234, maxDiscount: null },
    minimumOrder: null,
    orderTypes: ["delivery", "takeaway", "dine_in"],
    appliesTo: ["subtotal", "packaging_fee"],
    fundedBy: "shared",
    managedBy: "foodi",
    stackable: true,
    usageLimit: null,
    perCustomerLimit: 3,
    redemptionCount: 111,
  },
  {
    code: "PREVIEW-FLAT22",
    name: "Preview flat coupon",
    status: "active",
    startOffsetDays: -20,
    lengthDays: 60,
    discount: { type: "fixed_amount", amount: money(2222) },
    minimumOrder: money(22200),
    orderTypes: ["delivery"],
    appliesTo: ["delivery_fee"],
    fundedBy: "foodi",
    managedBy: "foodi",
    stackable: false,
    usageLimit: 2222,
    perCustomerLimit: null,
    redemptionCount: 777,
  },
  {
    code: "PREVIEW-HOLD33",
    status: "paused",
    startOffsetDays: -30,
    lengthDays: 90,
    discount: { type: "fixed_amount", amount: money(3333) },
    minimumOrder: null,
    orderTypes: ["takeaway"],
    appliesTo: null,
    fundedBy: null,
    managedBy: "restaurant",
    stackable: null,
    usageLimit: 500,
    perCustomerLimit: 2,
    redemptionCount: 44,
  },
  {
    code: "PREVIEW-OLD44",
    status: "expired",
    startOffsetDays: -80,
    lengthDays: 30,
    discount: { type: "percentage", rateBasisPoints: 2222, maxDiscount: money(4444) },
    minimumOrder: money(33300),
    orderTypes: null,
    appliesTo: ["subtotal"],
    fundedBy: "restaurant",
    managedBy: "restaurant",
    stackable: false,
    usageLimit: 100,
    perCustomerLimit: 1,
    redemptionCount: 100,
  },
  {
    code: "PREVIEW-NOSTATUS",
    status: null,
    startOffsetDays: -40,
    lengthDays: 20,
    discount: { type: "percentage", rateBasisPoints: 555, maxDiscount: null },
    minimumOrder: null,
    orderTypes: null,
    appliesTo: null,
    fundedBy: null,
    managedBy: null,
    stackable: null,
    usageLimit: null,
    perCustomerLimit: null,
    redemptionCount: null,
  },
  {
    code: "PREVIEW-CANCEL55",
    status: "cancelled",
    startOffsetDays: -50,
    lengthDays: 25,
    discount: { type: "fixed_amount", amount: money(5555) },
    minimumOrder: money(55500),
    orderTypes: ["dine_in"],
    appliesTo: ["subtotal"],
    fundedBy: "restaurant",
    managedBy: "restaurant",
    stackable: false,
    usageLimit: 50,
    perCustomerLimit: 1,
    redemptionCount: 3,
  },
  {
    code: "PREVIEW-BARE",
    status: "active",
    startOffsetDays: null,
    lengthDays: null,
    discount: { type: "fixed_amount", amount: money(111) },
    minimumOrder: null,
    orderTypes: null,
    appliesTo: null,
    fundedBy: null,
    managedBy: null,
    stackable: null,
    usageLimit: null,
    perCustomerLimit: null,
    redemptionCount: null,
  },
  {
    code: "PREVIEW-ZERO",
    status: "active",
    startOffsetDays: -3,
    lengthDays: 14,
    discount: { type: "percentage", rateBasisPoints: 0, maxDiscount: null },
    minimumOrder: money(0),
    orderTypes: ["delivery", "takeaway", "dine_in"],
    appliesTo: ["subtotal"],
    fundedBy: "restaurant",
    managedBy: "restaurant",
    stackable: true,
    usageLimit: 1,
    perCustomerLimit: 1,
    redemptionCount: 0,
  },
]

// A longer list so the directory has a second page (14 coupons). The extras are plain variations.
const EXTRA_COUNT = 5
const extra = (index: number): Row => ({
  code: `PREVIEW-EXTRA${index + 1}`,
  status: (["active", "expired", "scheduled", "paused", "cancelled"] as const)[index % 5],
  startOffsetDays: -90 - index * 7,
  lengthDays: 21,
  discount: { type: "fixed_amount", amount: money(1111 * (index + 1)) },
  minimumOrder: null,
  orderTypes: ["delivery"],
  appliesTo: ["subtotal"],
  fundedBy: "restaurant",
  managedBy: "restaurant",
  stackable: false,
  usageLimit: null,
  perCustomerLimit: null,
  redemptionCount: 10 + index,
})

/** Built when the preview store starts, so the dates are relative to now. */
export function buildFixturePromotions(now: number): Promotion[] {
  return [...ROWS, ...Array.from({ length: EXTRA_COUNT }, (_, index) => extra(index))].map((row, index) => {
    const { startOffsetDays, lengthDays, ...rest } = row
    const startsAt = startOffsetDays === null ? null : new Date(now + startOffsetDays * DAY).toISOString()
    const endsAt =
      startOffsetDays === null || lengthDays === null ? null : new Date(now + (startOffsetDays + lengthDays) * DAY).toISOString()
    return {
      id: `prv-promo-${String(index + 1).padStart(2, "0")}`,
      kind: "coupon" as const,
      name: null,
      minimumOrder: null,
      orderTypes: null,
      appliesTo: null,
      fundedBy: null,
      managedBy: null,
      stackable: null,
      usageLimit: null,
      perCustomerLimit: null,
      redemptionCount: null,
      ...rest,
      startsAt,
      endsAt,
    }
  })
}
