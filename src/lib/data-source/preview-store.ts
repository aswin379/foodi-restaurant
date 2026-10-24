import "server-only"

import { ServiceError } from "./errors"
import { assertPreviewAllowed } from "./mode"

/**
 * In-memory store for simulated writes in preview mode (G1). It lives in the
 * preview server's memory only: nothing reaches Foodi, and everything resets
 * when the server restarts. Every operation refuses to run in production.
 *
 * Reads and writes copy records, so a screen can't change stored data by
 * mutating an object it was given.
 */
export class PreviewCollection<Item extends { id: string }> {
  private items = new Map<string, Item>()

  constructor(
    readonly name: string,
    private readonly seed: () => Item[]
  ) {
    assertPreviewAllowed()
    this.reset()
  }

  list(): Item[] {
    assertPreviewAllowed()
    return [...this.items.values()].map((item) => structuredClone(item))
  }

  get(id: string): Item | null {
    assertPreviewAllowed()
    const item = this.items.get(id)
    return item ? structuredClone(item) : null
  }

  insert(item: Item): Item {
    assertPreviewAllowed()
    if (this.items.has(item.id)) {
      throw new ServiceError("conflict", `${this.name} ${item.id} already exists.`)
    }
    this.items.set(item.id, structuredClone(item))
    return structuredClone(item)
  }

  /** Throws "not_found" for unknown ids; the updater may throw to refuse a change. */
  update(id: string, updater: (current: Item) => Item): Item {
    assertPreviewAllowed()
    const current = this.items.get(id)
    if (!current) throw new ServiceError("not_found", `${this.name} ${id} not found.`)
    const next = updater(structuredClone(current))
    if (next.id !== id) {
      throw new ServiceError("validation", "A preview update can't change the record id.")
    }
    this.items.set(id, structuredClone(next))
    return structuredClone(next)
  }

  remove(id: string): void {
    assertPreviewAllowed()
    if (!this.items.delete(id)) {
      throw new ServiceError("not_found", `${this.name} ${id} not found.`)
    }
  }

  reset(): void {
    assertPreviewAllowed()
    this.items = new Map(this.seed().map((item) => [item.id, structuredClone(item)]))
  }
}

// One collection per name for the life of the server process, so simulated
// changes survive navigation (and dev hot reloads) until a restart.
const registryKey = Symbol.for("foodi.previewStore")
type Registry = Map<string, PreviewCollection<{ id: string }>>

function registry(): Registry {
  const holder = globalThis as typeof globalThis & { [registryKey]?: Registry }
  holder[registryKey] ??= new Map()
  return holder[registryKey]
}

export function getPreviewCollection<Item extends { id: string }>(
  name: string,
  seed: () => Item[]
): PreviewCollection<Item> {
  assertPreviewAllowed()
  const existing = registry().get(name)
  if (existing) return existing as unknown as PreviewCollection<Item>
  const created = new PreviewCollection(name, seed)
  registry().set(name, created as unknown as PreviewCollection<{ id: string }>)
  return created
}

/** Test helper: forget every collection, as a server restart would. */
export function clearPreviewCollections() {
  registry().clear()
}
