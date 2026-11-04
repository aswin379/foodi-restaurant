import { http } from "@/lib/http"

import type {
  BulkInput,
  Destination,
  DestinationPage,
  DestinationQuery,
  GenerateMissingResult,
  LocationsOverview,
  PlaceType,
} from "./types"

// Requests are scoped to the active restaurant (X-Seller-Id); the API checks the owner or staff member may use it.
const PATH = "/seller/locations"
const SCOPED = { restaurantScoped: true } as const

export function getOverview(): Promise<LocationsOverview> {
  return http.get<LocationsOverview>(PATH, SCOPED)
}

function listPath(query: DestinationQuery): string {
  const search = new URLSearchParams({
    type: query.type,
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.q) search.set("q", query.q)
  return `${PATH}/destinations?${search.toString()}`
}

export function listDestinations(query: DestinationQuery): Promise<DestinationPage> {
  return http.get<DestinationPage>(listPath(query), SCOPED)
}

/** Every page of one list, for "Print all". */
export async function listAllDestinations(query: Omit<DestinationQuery, "page" | "pageSize">): Promise<Destination[]> {
  const all: Destination[] = []
  for (let page = 1; ; page += 1) {
    const result = await listDestinations({ ...query, page, pageSize: 100 })
    all.push(...result.items)
    if (all.length >= result.total || result.items.length === 0) return all
  }
}

export async function createDestination(input: {
  type: PlaceType
  label: string
  generateQr: boolean
}): Promise<Destination> {
  return (await http.post<{ destination: Destination }>(`${PATH}/destinations`, input, SCOPED)).destination
}

export function bulkCreate(
  input: { type: PlaceType; generateQr: boolean } & BulkInput,
): Promise<{ created: number }> {
  return http.post<{ created: number }>(`${PATH}/destinations/bulk`, input, SCOPED)
}

export async function renameDestination(id: number, label: string): Promise<Destination> {
  return (await http.patch<{ destination: Destination }>(`${PATH}/destinations/${id}`, { label }, SCOPED)).destination
}

export async function setDestinationActive(id: number, isActive: boolean): Promise<Destination> {
  return (await http.patch<{ destination: Destination }>(`${PATH}/destinations/${id}/status`, { isActive }, SCOPED))
    .destination
}

/** Creates the first QR code of a location that was saved without one. Never changes an existing QR. */
export async function generateQr(id: number): Promise<Destination> {
  return (await http.post<{ destination: Destination }>(`${PATH}/destinations/${id}/generate`, undefined, SCOPED))
    .destination
}

/** Creates every missing QR code of one list. Safe to repeat. */
export function generateMissing(input: { type: PlaceType }): Promise<GenerateMissingResult> {
  return http.post<GenerateMissingResult>(`${PATH}/destinations/generate-missing`, input, SCOPED)
}

/** A new token: every printed copy of the old QR code stops working. */
export async function regenerateQr(id: number): Promise<Destination> {
  return (await http.post<{ destination: Destination }>(`${PATH}/destinations/${id}/regenerate`, undefined, SCOPED))
    .destination
}

export async function createSingleQr(): Promise<Destination> {
  return (await http.post<{ destination: Destination }>(`${PATH}/general`, undefined, SCOPED)).destination
}
