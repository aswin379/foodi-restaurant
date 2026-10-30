import type { FloorTable } from "./index"

// Sample floor plan for the preview only. Names are placeholders; nothing here is a real restaurant's layout.
export const PREVIEW_TABLES: FloorTable[] = [
  { id: "prv-tbl-1", name: "Table 1", zone: "Main hall", capacity: 2, status: "available", x: 8, y: 12, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-2", name: "Table 2", zone: "Main hall", capacity: 2, status: "occupied", x: 30, y: 12, occupiedMinutes: 42, guests: 2, order: null },
  { id: "prv-tbl-3", name: "Table 3", zone: "Main hall", capacity: 4, status: "reserved", x: 52, y: 12, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-4", name: "Table 4", zone: "Main hall", capacity: 4, status: "available", x: 74, y: 12, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-5", name: "Table 5", zone: "Main hall", capacity: 4, status: "occupied", x: 8, y: 42, occupiedMinutes: 18, guests: 3, order: { id: "prv-1005", reference: "PRV-1005", totalMinor: 42000 } },
  { id: "prv-tbl-6", name: "Table 6", zone: "Main hall", capacity: 6, status: "cleaning", x: 30, y: 42, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-7", name: "Table 7", zone: "Main hall", capacity: 6, status: "available", x: 52, y: 42, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-8", name: "Table 8", zone: "Main hall", capacity: 8, status: "occupied", x: 74, y: 42, occupiedMinutes: 66, guests: 7, order: null },
  { id: "prv-tbl-9", name: "Patio 1", zone: "Patio", capacity: 2, status: "available", x: 8, y: 72, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-10", name: "Patio 2", zone: "Patio", capacity: 2, status: "reserved", x: 30, y: 72, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-11", name: "Patio 3", zone: "Patio", capacity: 4, status: "available", x: 52, y: 72, occupiedMinutes: null, guests: null, order: null },
  { id: "prv-tbl-12", name: "Patio 4", zone: "Patio", capacity: 4, status: "occupied", x: 74, y: 72, occupiedMinutes: 9, guests: 4, order: null },
]
