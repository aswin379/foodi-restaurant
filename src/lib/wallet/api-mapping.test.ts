// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  settlementDetailFromApi,
  settlementListFromApi,
  settlementOrdersFromApi,
  walletSummaryFromApi,
} from "./api-mapping"

const expected = { currency: "INR" }
const inr = (amountMinor: number) => ({ amountMinor, currency: "INR" })
const settlement = {
  id: "set_1",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-07",
  status: "paid",
  grossAmount: inr(111100),
  netAmount: inr(99000),
  orderCount: 12,
  paidAt: "2026-10-09T10:00:00Z",
}
const detail = {
  ...settlement,
  payoutDestinationLabel: "Bank •••• 1234",
  lines: [
    { kind: "commission", label: "Platform commission", amount: inr(-11110) },
    { kind: "refund", label: "Refund, order A", amount: inr(-5000), refundStatus: "pending" },
  ],
}
const page = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false }
const order = {
  id: "ord_1",
  reference: "A-1001",
  placedAt: "2026-10-02T10:00:00Z",
  orderTotal: inr(52000),
  commission: inr(-5200),
  net: inr(46800),
  refund: null,
}
const rejects = (run: () => unknown) => expect(run).toThrow(expect.objectContaining({ kind: "unavailable" }))

describe("walletSummaryFromApi", () => {
  const summary = { pendingSettlement: inr(333300), paidOut: inr(9999900), onHold: inr(0), asOf: "2026-10-10T00:00:00Z", payoutDestinationLabel: "Bank •••• 1234" }

  it("maps named amounts", () => {
    expect(walletSummaryFromApi(summary, expected)).toEqual(summary)
  })

  it("keeps missing amounts null, never zero, and a real zero as zero", () => {
    expect(walletSummaryFromApi({}, expected)).toEqual({
      pendingSettlement: null,
      paidOut: null,
      onHold: null,
      asOf: null,
      payoutDestinationLabel: null,
    })
    expect(walletSummaryFromApi({ onHold: inr(0) }, expected).onHold).toEqual(inr(0))
  })

  it("never adds up the amounts: no total field exists", () => {
    expect(Object.keys(walletSummaryFromApi(summary, expected)).sort()).toEqual(
      ["asOf", "onHold", "paidOut", "payoutDestinationLabel", "pendingSettlement"]
    )
  })

  it("reads only known fields: raw bank or account details never reach the model", () => {
    const mapped = walletSummaryFromApi(
      { ...summary, accountNumber: "000011112222", iban: "XX00TEST0000", bankName: "Some Bank", balance: inr(1) },
      expected
    )
    expect(JSON.stringify(mapped)).not.toMatch(/000011112222|XX00TEST|Some Bank|balance/)
  })

  it.each([
    ["a full account number", "000011112222"],
    ["an unmasked label with digits", "Account 12345"],
    ["a label with no mask", "Main account"],
    ["a mask with too many digits", "•••• 12345"],
    ["a blank label", "  "],
    ["a very long label", `•${"x".repeat(60)}`],
  ])("refuses %s as a payout destination", (_label, payoutDestinationLabel) => {
    rejects(() => walletSummaryFromApi({ payoutDestinationLabel }, expected))
  })

  it("never repeats a refused value in the error", () => {
    try {
      walletSummaryFromApi({ payoutDestinationLabel: "000011112222" }, expected)
      expect.unreachable()
    } catch (error) {
      expect(String((error as Error).message)).not.toMatch(/0000/)
    }
  })

  it.each([
    ["a fractional amount", { pendingSettlement: inr(10.5) }],
    ["a negative balance", { paidOut: inr(-1) }],
    ["a string amount", { onHold: { amountMinor: "100", currency: "INR" } }],
    ["an unsafe integer", { paidOut: inr(2 ** 60) }],
    ["NaN", { paidOut: inr(Number.NaN) }],
    ["another currency", { paidOut: { amountMinor: 100, currency: "USD" } }],
    ["a missing currency", { paidOut: { amountMinor: 100 } }],
    ["an amount that is not an object", { paidOut: 100 }],
    ["a bad as-of date", { asOf: "soon" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => walletSummaryFromApi(patch, expected))
  })

  it.each([null, "x", 1, []])("refuses %j as a wallet", (value) => {
    rejects(() => walletSummaryFromApi(value, expected))
  })
})

describe("settlementListFromApi", () => {
  it("maps settlements with server-supplied periods and statuses", () => {
    const result = settlementListFromApi({ items: [settlement], ...page }, expected)
    expect(result.items[0]).toEqual(settlement)
    expect(result).toMatchObject(page)
  })

  it("keeps a missing status, amount, count and paid date as null", () => {
    const result = settlementListFromApi({ items: [{ id: "set_2", periodStart: "2026-10-01", periodEnd: "2026-10-07" }], ...page }, expected)
    expect(result.items[0]).toEqual({
      id: "set_2",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-07",
      status: null,
      grossAmount: null,
      netAmount: null,
      orderCount: null,
      paidAt: null,
    })
  })

  it("allows a negative net amount (adjustments can exceed earnings) but not a negative gross", () => {
    expect(settlementListFromApi({ items: [{ ...settlement, netAmount: inr(-500) }], ...page }, expected).items[0].netAmount).toEqual(inr(-500))
    rejects(() => settlementListFromApi({ items: [{ ...settlement, grossAmount: inr(-500) }], ...page }, expected))
  })

  it.each(["paid ", "PAID", "complete", "settled", "refunded", "unknown", "", 1])(
    "refuses the unknown status %j and never maps it to paid",
    (status) => {
      rejects(() => settlementListFromApi({ items: [{ ...settlement, status }], ...page }, expected))
    }
  )

  it.each(["pending", "processing", "paid", "failed", "on_hold"])("accepts the proposed status %s", (status) => {
    expect(settlementListFromApi({ items: [{ ...settlement, status }], ...page }, expected).items[0].status).toBe(status)
  })

  it.each([
    ["a bad period start", { periodStart: "2026-13-01" }],
    ["a date that does not exist", { periodStart: "2026-02-30" }],
    ["a period start that is a timestamp", { periodStart: "2026-10-01T00:00:00Z" }],
    ["a period that ends before it starts", { periodStart: "2026-10-08" }],
    ["a missing period end", { periodEnd: undefined }],
    ["an unsafe settlement id", { id: "a/b" }],
    ["a fractional order count", { orderCount: 1.5 }],
    ["a negative order count", { orderCount: -1 }],
    ["a fractional gross", { grossAmount: inr(1.5) }],
    ["another currency", { netAmount: { amountMinor: 1, currency: "EUR" } }],
    ["a bad paid date", { paidAt: "yesterday" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => settlementListFromApi({ items: [{ ...settlement, ...patch }], ...page }, expected))
  })

  it("accepts a source with no totals: they stay null, never invented", () => {
    const result = settlementListFromApi(
      { items: [settlement], page: 2, pageSize: 10, totalItems: null, totalPages: null, hasNextPage: true },
      expected
    )
    expect(result).toMatchObject({ page: 2, totalItems: null, totalPages: null, hasNextPage: true })
  })

  it.each([
    ["a missing items list", { items: undefined }],
    ["a missing next-page flag", { hasNextPage: undefined }],
    ["more items than the page size", { pageSize: 0 }],
    ["totals that disagree", { totalItems: 25, totalPages: 1 }],
    ["a next-page flag that contradicts the totals", { totalItems: 25, totalPages: 3, hasNextPage: false }],
    ["a page of zero", { page: 0 }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => settlementListFromApi({ items: [settlement], ...page, ...patch }, expected))
  })

  it("reads only known fields", () => {
    const mapped = settlementListFromApi({ items: [{ ...settlement, accountNumber: "000011112222", restaurantId: "r1" }], ...page }, expected)
    expect(JSON.stringify(mapped)).not.toMatch(/000011112222|restaurantId/)
  })
})

describe("settlementDetailFromApi", () => {
  it("maps the settlement with its labelled lines and masked destination", () => {
    const mapped = settlementDetailFromApi(detail, expected)
    expect(mapped.payoutDestinationLabel).toBe("Bank •••• 1234")
    expect(mapped.lines).toEqual([
      { kind: "commission", label: "Platform commission", amount: inr(-11110), refundStatus: null },
      { kind: "refund", label: "Refund, order A", amount: inr(-5000), refundStatus: "pending" },
    ])
  })

  it("does not check that the lines add up to the net amount", () => {
    // 111100 - 11110 - 5000 is not 99000, and the mapper does not say so: it validates shape only.
    expect(() => settlementDetailFromApi(detail, expected)).not.toThrow()
  })

  it("requires a lines array, which may be empty", () => {
    expect(settlementDetailFromApi({ ...detail, lines: [] }, expected).lines).toEqual([])
    rejects(() => settlementDetailFromApi({ ...detail, lines: undefined }, expected))
    rejects(() => settlementDetailFromApi({ ...detail, lines: "x" }, expected))
  })

  it("keeps a pending refund distinct from a provider-confirmed one, and requires a status on refunds only", () => {
    const lines = (refundStatus: unknown) => [{ kind: "refund", label: "Refund", amount: inr(-1), refundStatus }]
    expect(settlementDetailFromApi({ ...detail, lines: lines("pending") }, expected).lines[0].refundStatus).toBe("pending")
    expect(settlementDetailFromApi({ ...detail, lines: lines("confirmed") }, expected).lines[0].refundStatus).toBe("confirmed")
    rejects(() => settlementDetailFromApi({ ...detail, lines: lines(undefined) }, expected))
    rejects(() => settlementDetailFromApi({ ...detail, lines: lines("refunded") }, expected))
    rejects(() => settlementDetailFromApi({ ...detail, lines: lines("succeeded") }, expected))
    rejects(() =>
      settlementDetailFromApi({ ...detail, lines: [{ kind: "fee", label: "Fee", amount: inr(-1), refundStatus: "confirmed" }] }, expected)
    )
  })

  it.each([
    ["an unknown line kind", { kind: "payout" }],
    ["a blank label", { label: " " }],
    ["a missing amount", { amount: undefined }],
    ["a fractional amount", { amount: inr(-1.5) }],
    ["another currency", { amount: { amountMinor: -1, currency: "USD" } }],
  ])("refuses a line with %s", (_label, patch) => {
    rejects(() =>
      settlementDetailFromApi({ ...detail, lines: [{ kind: "fee", label: "Fee", amount: inr(-1), ...patch }] }, expected)
    )
  })

  it("refuses a payout destination that is not masked", () => {
    rejects(() => settlementDetailFromApi({ ...detail, payoutDestinationLabel: "000011112222" }, expected))
  })
})

describe("settlementOrdersFromApi", () => {
  it("maps the breakdown", () => {
    expect(settlementOrdersFromApi({ items: [order], ...page }, expected).items).toEqual([order])
  })

  it("keeps a missing id (no link), date and amounts as null", () => {
    expect(settlementOrdersFromApi({ items: [{ reference: "A-2" }], ...page }, expected).items[0]).toEqual({
      id: null,
      reference: "A-2",
      placedAt: null,
      orderTotal: null,
      commission: null,
      net: null,
      refund: null,
    })
  })

  it("keeps a pending order refund distinct from a confirmed one", () => {
    const withRefund = (status: string) => ({ ...order, refund: { amount: inr(-100), status } })
    expect(settlementOrdersFromApi({ items: [withRefund("pending")], ...page }, expected).items[0].refund?.status).toBe("pending")
    expect(settlementOrdersFromApi({ items: [withRefund("confirmed")], ...page }, expected).items[0].refund?.status).toBe("confirmed")
    rejects(() => settlementOrdersFromApi({ items: [withRefund("done")], ...page }, expected))
  })

  it.each([
    ["an unsafe order id", { id: "../x" }],
    ["a blank reference", { reference: "" }],
    ["a negative order total", { orderTotal: inr(-1) }],
    ["a fractional commission", { commission: inr(1.5) }],
    ["another currency", { net: { amountMinor: 1, currency: "USD" } }],
    ["a bad date", { placedAt: "x" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => settlementOrdersFromApi({ items: [{ ...order, ...patch }], ...page }, expected))
  })

  it("ignores any customer name or contact field sent with an order", () => {
    const mapped = settlementOrdersFromApi({ items: [{ ...order, customerName: "Someone", phone: "+10000000000" }], ...page }, expected)
    expect(JSON.stringify(mapped)).not.toMatch(/Someone|10000000000/)
  })
})
