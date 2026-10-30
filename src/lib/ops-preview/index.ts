import { ServiceError } from "@/lib/data-source/errors"
import { resolveDataSourceMode, type DataSourceMode } from "@/lib/data-source/mode"

/**
 * Modules with no backend model yet (tables, staff and roles, reports) show labelled sample data only when
 * they are explicitly opted in (FOODI_<MODULE>_DATA_SOURCE=preview, refused in production like every other
 * module). Otherwise they report "not connected": there is no fallback to sample data.
 */
export function opsMode(value: string | undefined): DataSourceMode {
  return resolveDataSourceMode(value)
}

/** `?preview=empty|error` shows those states in preview mode, like the other modules. */
export function opsScenario(value: unknown): "empty" | "error" | null {
  return value === "empty" || value === "error" ? value : null
}

/**
 * Loads sample data in preview mode and refuses with `not_configured` otherwise. `load` imports the
 * fixtures lazily, so they are not even loaded outside preview mode.
 */
export async function loadOpsPreview<T>(value: string | undefined, scenario: unknown, empty: T, load: () => Promise<T>): Promise<T> {
  if (opsMode(value) !== "preview") throw new ServiceError("not_configured")
  const shown = opsScenario(scenario)
  if (shown === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  if (shown === "empty") return empty
  return load()
}
