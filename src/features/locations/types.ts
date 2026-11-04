export type PlaceType = "TABLE" | "ROOM" | "SEAT"

/** One table, room or seat (or the single QR, type GENERAL) as the API returns it. */
export type Destination = {
  id: number
  type: "GENERAL" | PlaceType
  label: string | null
  /** Row of a seat ("A"); null for tables, rooms and the single QR. */
  groupName: string | null
  /** False for a location saved without a QR code: it cannot be scanned until one is generated. */
  qrGenerated: boolean
  /** Random public identifier. The QR code encodes `url`, which only changes when the token is regenerated. */
  token: string | null
  url: string | null
  isActive: boolean
  createdAt: string
}

export type LocationsOverview = {
  sellerId: number
  status: string
  /** False while the restaurant is not live: the page then shows a notice and cannot change anything. */
  canManage: boolean
  /** Which ways of ordering are on. They decide which kinds of location can be created. */
  services: {
    dineIn: boolean
    roomService: boolean
    theaterService: boolean
    takeAway: boolean
    delivery: boolean
  }
  /** How many tables, rooms and seats the restaurant has. */
  counts: { tables: number; rooms: number; seats: number }
  general: Destination | null
}

export type DestinationPage = {
  items: Destination[]
  total: number
  /** How many in this list (ignoring the search) still have no QR code. */
  missingQr: number
  page: number
  pageSize: number
}

export type DestinationQuery = {
  type: PlaceType
  q?: string
  page: number
  pageSize: number
}

/** Ways to add several at once: a number range, a custom list, or (seats) rows x seat numbers. */
export type BulkInput =
  | { prefix: string; from: number; to: number }
  | { labels: string[] }
  | { rows: string[]; seatFrom: number; seatTo: number }

export type GenerateMissingResult = {
  generated: number
  skipped: number
  failed: number
  failedIds: number[]
}

export const PLACE_TEXT: Record<
  PlaceType,
  { one: string; many: string; Title: string; TitleMany: string; example: string }
> = {
  TABLE: { one: "table", many: "tables", Title: "Table", TitleMany: "Tables", example: "5, A12 or Terrace 3" },
  ROOM: { one: "room", many: "rooms", Title: "Room", TitleMany: "Rooms", example: "101 or 12B" },
  SEAT: { one: "seat", many: "seats", Title: "Seat", TitleMany: "Seats", example: "A-14" },
}

/** Rows typed as a letter range ("A-F") or a list ("A, B, Balcony"). Returns [] for a range that makes no sense. */
export function parseRows(text: string): string[] {
  const value = text.trim()
  const range = /^([A-Za-z])\s*-\s*([A-Za-z])$/.exec(value)
  if (range) {
    const first = (range[1] as string).toUpperCase().charCodeAt(0)
    const last = (range[2] as string).toUpperCase().charCodeAt(0)
    if (last < first) return []
    return Array.from({ length: last - first + 1 }, (_, i) => String.fromCharCode(first + i))
  }
  return [...new Set(value.split(/[\n,]+/).map((row) => row.trim()).filter(Boolean))]
}
