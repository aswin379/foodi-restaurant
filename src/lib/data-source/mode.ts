import { ServiceError } from "./errors"

/**
 * "api"     – the real Foodi API (the default, and the only mode in production).
 * "preview" – labelled sample data with simulated writes, for development only.
 */
export type DataSourceMode = "api" | "preview"

// "fixtures" is the value the existing Orders and Menu modules already use.
const PREVIEW_VALUES: ReadonlySet<string> = new Set(["preview", "fixtures"])

export function isProductionRuntime(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv === "production"
}

/**
 * Preview is an explicit opt-in per module (e.g.
 * FOODI_RESTAURANT_DATA_SOURCE=preview) and is refused in production: there
 * it resolves to "api" whatever the variable says. Nothing ever switches to
 * preview because the API failed.
 */
export function resolveDataSourceMode(
  value: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): DataSourceMode {
  return value !== undefined &&
    PREVIEW_VALUES.has(value) &&
    !isProductionRuntime(nodeEnv)
    ? "preview"
    : "api"
}

/** Guard for code that must never run in production (preview stores, sample data). */
export function assertPreviewAllowed(nodeEnv: string | undefined = process.env.NODE_ENV) {
  if (isProductionRuntime(nodeEnv)) {
    throw new ServiceError("forbidden", "Preview data is not available in production.")
  }
}

/**
 * Picks one adapter for a module. The preview adapter is created lazily, so
 * its sample data isn't even loaded unless preview mode was chosen. Errors
 * from the chosen adapter propagate to the caller; there is no fallback.
 */
export function selectAdapter<Adapter>(options: {
  /** Raw value of the module's data-source environment variable. */
  modeValue: string | undefined
  api: Adapter
  preview: () => Adapter
  nodeEnv?: string
}): { mode: DataSourceMode; adapter: Adapter } {
  const mode = resolveDataSourceMode(options.modeValue, options.nodeEnv)
  if (mode === "preview") {
    assertPreviewAllowed(options.nodeEnv)
    return { mode, adapter: options.preview() }
  }
  return { mode, adapter: options.api }
}
