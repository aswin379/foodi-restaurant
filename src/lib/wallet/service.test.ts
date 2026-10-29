// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"
import { buildFixtureOrders } from "@/lib/orders/fixtures/orders"

import { buildFixtureSettlements, buildFixtureWallet, PREVIEW_PAYOUT_LABEL } from "./fixtures/wallet"
import { parseSettlementListQuery, parseSettlementOrdersQuery } from "./query"
import {
  getSettlement,
  getWalletContext,
  getWalletSummary,
  listSettlementOrders,
  listSettlements,
  walletMode,
} from "./service"

// connection() needs a live request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }))

const query = (params: Record<string, string> = {}) => parseSettlementListQuery(params)
const orders = (params: Record<string, string> = {}) => parseSettlementOrdersQuery(params)
const notConfigured = expect.objectContaining({ kind: "not_configured" })

beforeEach(() => {
  vi.stubEnv("FOODI_WALLET_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => {
  clearPreviewCollections()
  vi.unstubAllEnvs()
})

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("FOODI_WALLET_DATA_SOURCE", "preview")
}

describe("wallet data source", () => {
  it("refuses preview data in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview", "PREVIEW", "true"]) {
      vi.stubEnv("FOODI_WALLET_DATA_SOURCE", value)
      expect(walletMode()).toBe("api")
      await expect(getWalletSummary()).rejects.toEqual(notConfigured)
      await expect(listSettlements(query())).rejects.toEqual(notConfigured)
      await expect(getSettlement("prv-set-01")).rejects.toEqual(notConfigured)
      await expect(listSettlementOrders("prv-set-01", orders())).rejects.toEqual(notConfigured)
      await expect(getWalletContext()).rejects.toEqual(notConfigured)
    }
  })

  it("ignores preview scenarios in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_WALLET_DATA_SOURCE", "preview")
    for (const scenario of ["empty", "error", "slow", "forbidden"]) {
      await expect(getWalletSummary(scenario)).rejects.toEqual(notConfigured)
      await expect(listSettlements(query(), scenario)).rejects.toEqual(notConfigured)
      await expect(getSettlement("prv-set-01", scenario)).rejects.toEqual(notConfigured)
    }
  })

  it("uses the API (not configured) outside production unless preview is chosen, with no fallback", async () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(walletMode()).toBe("api")
    await expect(getWalletSummary()).rejects.toEqual(notConfigured)
    await expect(listSettlements(query())).rejects.toEqual(notConfigured)
  })
})

describe("preview wallet", () => {
  beforeEach(preview)

  it("gives named, nullable amounts and a masked label", async () => {
    const summary = await getWalletSummary()
    expect(summary.pendingSettlement).not.toBeNull()
    expect(summary.paidOut).not.toBeNull()
    expect(summary.onHold).toBeNull()
    expect(summary.payoutDestinationLabel).toBe(PREVIEW_PAYOUT_LABEL)
  })

  it("lists ten settlements a page, newest period first, with totals", async () => {
    const first = await listSettlements(query())
    expect(first).toMatchObject({ page: 1, pageSize: 10, totalItems: 14, totalPages: 2, hasNextPage: true })
    expect(first.items).toHaveLength(10)
    const ends = first.items.map((settlement) => settlement.periodEnd)
    expect(ends).toEqual([...ends].sort().reverse())
    const second = await listSettlements(query({ page: "2" }))
    expect(second.items).toHaveLength(4)
    expect(second.hasNextPage).toBe(false)
    expect((await listSettlements(query({ page: "99" }))).page).toBe(2)
  })

  it("keeps lines, destination and order breakdown out of the list", async () => {
    const { items } = await listSettlements(query())
    expect(JSON.stringify(items)).not.toMatch(/"lines"|"orders"|payoutDestinationLabel/)
    expect(JSON.stringify(await getSettlement("prv-set-01"))).not.toContain('"orders"')
  })

  it("shows every status the contract proposes, a missing status and unavailable amounts", async () => {
    const all = [...(await listSettlements(query())).items, ...(await listSettlements(query({ page: "2" }))).items]
    expect(new Set(all.map((settlement) => settlement.status))).toEqual(
      new Set(["pending", "processing", "paid", "failed", "on_hold", null])
    )
    const unavailable = all.find((settlement) => settlement.grossAmount === null)
    expect(unavailable).toMatchObject({ netAmount: null, orderCount: null })
  })

  it("returns null for an unknown settlement, for both detail and breakdown", async () => {
    expect(await getSettlement("prv-set-99")).toBeNull()
    expect(await listSettlementOrders("prv-set-99", orders())).toBeNull()
  })

  it("pages a long order breakdown, and gives an empty one for a settlement with no orders", async () => {
    const one = await listSettlementOrders("prv-set-01", orders())
    expect(one).toMatchObject({ page: 1, totalItems: 15, totalPages: 2, hasNextPage: true })
    expect((await listSettlementOrders("prv-set-01", orders({ orders: "2" })))?.items).toHaveLength(5)
    expect(await listSettlementOrders("prv-set-14", orders())).toMatchObject({ items: [], totalItems: 0, hasNextPage: false })
  })

  it("shows a pending and a confirmed refund, as separate states", async () => {
    const lines = [...(await getSettlement("prv-set-02"))!.lines, ...(await getSettlement("prv-set-03"))!.lines]
    expect(lines.filter((line) => line.kind === "refund").map((line) => line.refundStatus).sort()).toEqual(["confirmed", "pending"])
  })

  it("supports the empty, error and forbidden scenarios", async () => {
    expect((await listSettlements(query(), "empty")).totalItems).toBe(0)
    expect(await getWalletSummary("empty")).toEqual({ pendingSettlement: null, paidOut: null, onHold: null, asOf: null, payoutDestinationLabel: null })
    expect(await getSettlement("prv-set-01", "empty")).toBeNull()
    await expect(getWalletSummary("error")).rejects.toEqual(expect.objectContaining({ kind: "unavailable" }))
    await expect(listSettlements(query(), "forbidden")).rejects.toEqual(expect.objectContaining({ kind: "forbidden" }))
    await expect(listSettlementOrders("prv-set-01", orders(), "error")).rejects.toEqual(expect.objectContaining({ kind: "unavailable" }))
  })
})

describe("preview fixtures", () => {
  it("link every breakdown row to a sample order that exists, except the one with no order id", () => {
    vi.stubEnv("NODE_ENV", "development")
    const sample = new Map(buildFixtureOrders(Date.now()).map((order) => [order.id, order]))
    const rows = buildFixtureSettlements(Date.now()).flatMap((settlement) => settlement.orders)
    expect(rows.length).toBe(sample.size)
    expect(rows.filter((row) => row.id === null)).toHaveLength(1)
    for (const row of rows) {
      if (row.id === null) continue
      expect(sample.get(row.id)?.total).toEqual(row.orderTotal)
      expect(sample.get(row.id)?.reference).toBe(row.reference)
    }
  })

  it("use obviously fictional amounts and only masked destination labels", () => {
    vi.stubEnv("NODE_ENV", "development")
    for (const settlement of buildFixtureSettlements(Date.now())) {
      if (settlement.grossAmount) expect(settlement.grossAmount.amountMinor % 111100).toBe(0)
      if (settlement.payoutDestinationLabel) {
        expect(settlement.payoutDestinationLabel).toMatch(/•/)
        expect(settlement.payoutDestinationLabel.match(/\d/g)?.length ?? 0).toBeLessThanOrEqual(4)
      }
    }
    expect(buildFixtureWallet().payoutDestinationLabel).toBe(PREVIEW_PAYOUT_LABEL)
    expect(buildFixtureWallet().pendingSettlement?.amountMinor).toBe(333300)
  })
})
