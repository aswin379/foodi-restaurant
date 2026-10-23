import { isServiceError, type ServiceErrorKind } from "./errors"
import type { DataSourceMode } from "./mode"

/**
 * What every Server Action returns. `preview: true` marks a simulated change,
 * which the UI must label "Preview only, not saved to Foodi".
 */
export type ActionResult<Data = undefined> =
  | { ok: true; data: Data; preview: boolean }
  | {
      ok: false
      reason: ServiceErrorKind
      message: string
      fieldErrors?: Record<string, string>
    }

export type ActionFailure = Extract<ActionResult, { ok: false }>

// Messages never repeat raw server or exception text to the user.
export const ACTION_FAILURE_MESSAGES: Record<ServiceErrorKind, string> = {
  not_configured: "This isn't connected to Foodi yet, so nothing was changed.",
  unavailable: "Foodi couldn't be reached, so nothing was changed. Try again.",
  forbidden: "You don't have permission to do this.",
  not_found: "This record no longer exists.",
  conflict: "This was changed elsewhere. Reload to see the latest version.",
  validation: "Some details need correcting.",
}

export function actionSuccess<Data>(
  data: Data,
  mode: DataSourceMode
): ActionResult<Data> {
  return { ok: true, data, preview: mode === "preview" }
}

export function actionFailure(
  reason: ServiceErrorKind,
  fieldErrors?: Record<string, string>
): ActionFailure {
  return {
    ok: false,
    reason,
    message: ACTION_FAILURE_MESSAGES[reason],
    ...(fieldErrors ? { fieldErrors } : {}),
  }
}

/** Unknown errors are reported as "unavailable"; their details stay on the server. */
export function toActionFailure(error: unknown): ActionFailure {
  if (isServiceError(error)) return actionFailure(error.kind, error.fieldErrors)
  return actionFailure("unavailable")
}

/**
 * Runs one data-source call for a Server Action. A failure is returned, never
 * retried against another source.
 */
export async function runAction<Data>(
  mode: DataSourceMode,
  operation: () => Promise<Data>
): Promise<ActionResult<Data>> {
  try {
    return actionSuccess(await operation(), mode)
  } catch (error) {
    return toActionFailure(error)
  }
}
