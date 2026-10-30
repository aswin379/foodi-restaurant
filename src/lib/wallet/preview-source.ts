import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { WalletAdapter } from "./adapter"
import { buildFixtureSettlements, buildFixtureWallet, type PreviewSettlement } from "./fixtures/wallet"
import type { PageInfo, SettlementDetail, WalletSummary } from "./types"

// PREVIEW ADAPTER (development only). Read-only, obviously fictional sample
// data in the in-memory preview store, which refuses to run in production. It
// plays the server for pagination only, so the screens can be tried; none of it
// is evidence of how a real settlement service behaves.

/** `?preview=empty|error|slow|forbidden` shows those states without a backend. */
export function parsePreviewScenario(value: unknown) {
  return value === "empty" || value === "error" || value === "slow" || value === "forbidden" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 80)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  if (scenario === "forbidden") throw new ServiceError("forbidden", "Preview scenario: forbidden")
  return scenario
}

const settlements = () =>
  getPreviewCollection<PreviewSettlement>("wallet.settlements", () => buildFixtureSettlements(Date.now()))

function paged<Item>(all: Item[], requestedPage: number, pageSize: number): { items: Item[] } & PageInfo {
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const start = (page - 1) * pageSize
  return {
    items: all.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: all.length,
    totalPages,
    hasNextPage: page < totalPages,
  }
}

/** The settlement fields only: the stored order breakdown stays out of list and detail results. */
function withoutOrders(settlement: PreviewSettlement): SettlementDetail {
  const { orders, ...detail } = settlement
  void orders
  return detail
}

const EMPTY_SUMMARY: WalletSummary = {
  pendingSettlement: null,
  paidOut: null,
  onHold: null,
  asOf: null,
  payoutDestinationLabel: null,
}

export function createPreviewWalletAdapter(): WalletAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async summary(previewScenario) {
      const scenario = await applyScenario(previewScenario)
      return scenario === "empty" ? { ...EMPTY_SUMMARY } : buildFixtureWallet()
    },

    async settlements(query, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const all = scenario === "empty" ? [] : settlements().list().sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
      // The list carries the summary fields only, not the lines or the destination.
      const summaries = all.map(withoutOrders).map(({ lines, payoutDestinationLabel, ...summary }) => (void [lines, payoutDestinationLabel], summary))
      return paged(summaries, query.page, query.pageSize)
    },

    async settlement(settlementId, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const settlement = scenario === "empty" ? null : settlements().get(settlementId)
      return settlement ? withoutOrders(settlement) : null
    },

    async settlementOrders(settlementId, query, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const settlement = scenario === "empty" ? null : settlements().get(settlementId)
      return settlement ? paged(settlement.orders, query.page, query.pageSize) : null
    },
  }
}
