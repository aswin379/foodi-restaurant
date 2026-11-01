/** Dropdown value for "Other (request a new zone)". */
export const OTHER_ZONE = "other"

/** What the server said about the pin: the zone it is in, "outside" every zone, or not checked yet. */
export type ZoneCheck = { id: number; name: string } | "outside" | null

/** One line about the pin and the chosen zone. `warn` marks a mismatch the owner must fix. */
export function zoneNote(zoneId: string, check: ZoneCheck): { text: string; warn: boolean } {
  if (check === null) {
    return { text: "Set the pin on the map. The zone is detected from it.", warn: false }
  }
  if (check === "outside") {
    return {
      text:
        zoneId === OTHER_ZONE
          ? "This location is outside every zone. A reviewer will set up the zone you request."
          : 'This location is outside every zone. Choose "Other" to request a new zone.',
      warn: zoneId !== OTHER_ZONE,
    }
  }
  if (zoneId === OTHER_ZONE) {
    return { text: `This location is inside the zone "${check.name}". Select it instead of requesting a new one.`, warn: true }
  }
  if (zoneId !== "" && zoneId !== String(check.id)) {
    return { text: `This location is in the zone "${check.name}", not the one selected above.`, warn: true }
  }
  return { text: `Zone: ${check.name}`, warn: false }
}

/** Error for the location fields, or undefined when the known pin check agrees with the selection. The server still decides. */
export function zoneMismatch(zoneId: string, check: ZoneCheck): string | undefined {
  if (check === null || zoneId === "") return undefined
  if (zoneId === OTHER_ZONE) return check === "outside" ? undefined : "This location is inside an existing zone. Select that zone instead."
  if (check === "outside") return "This location is outside every zone. Move the pin or request a new zone."
  return zoneId === String(check.id) ? undefined : "Please select a location within the selected zone."
}
