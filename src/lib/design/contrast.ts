// WCAG 2.x contrast helpers for the design tokens. Pure functions: the token
// tests and the preview-only /design-system page both use them, so the ratios
// shown to a reviewer are the ones the tests enforce.

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export function isHex(value: string) {
  return HEX_PATTERN.test(value)
}

function channel(value: number) {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

/** Relative luminance of a #RRGGBB colour. */
export function luminance(hex: string) {
  if (!isHex(hex)) throw new Error(`Not a #RRGGBB colour: ${hex}`)
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** Contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG 2.2 AA targets. */
export const CONTRAST_TARGETS = {
  /** Body text (SC 1.4.3). */
  text: 4.5,
  /** Large text, icons, focus indicators and the edges of controls (SC 1.4.11, 2.4.13). */
  ui: 3,
} as const
