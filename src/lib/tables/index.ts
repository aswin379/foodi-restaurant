import { connection } from "next/server"

import { loadOpsPreview, opsMode } from "@/lib/ops-preview"

export const TABLE_STATUSES = ["available", "occupied", "reserved", "cleaning"] as const
export type TableStatus = (typeof TABLE_STATUSES)[number]

/**
 * PROPOSED model for the floor plan. There is no tables API yet, so this is shown only as labelled preview
 * data; production reports "not connected".
 */
export type FloorTable = {
  id: string
  name: string
  zone: string
  capacity: number
  status: TableStatus
  /** Position on the floor plan, in percent of its width and height. */
  x: number
  y: number
  /** Only for occupied tables. */
  occupiedMinutes: number | null
  guests: number | null
  /** The order on the table, when the orders data links it. */
  order: { id: string; reference: string; totalMinor: number } | null
}

export const tablesMode = () => opsMode(process.env.FOODI_TABLES_DATA_SOURCE)

export async function listTables(scenario?: unknown): Promise<FloorTable[]> {
  await connection()
  return loadOpsPreview(process.env.FOODI_TABLES_DATA_SOURCE, scenario, [], async () => (await import("./fixtures")).PREVIEW_TABLES)
}
