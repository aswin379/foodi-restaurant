import { resolveDataSourceMode } from "@/lib/data-source/mode"

/**
 * The /design-system showcase is a development and review tool. Like every
 * preview in this app it is an explicit opt-in (FOODI_DESIGN_SYSTEM=preview)
 * and is refused in production builds, whatever the variable says. It isn't
 * linked from the navigation and shows no real customer or financial data.
 */
export function designSystemAvailable(): boolean {
  return resolveDataSourceMode(process.env.FOODI_DESIGN_SYSTEM) === "preview"
}
