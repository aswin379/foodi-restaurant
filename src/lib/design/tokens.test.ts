// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { contrastRatio, isHex } from "./contrast"
import { contrastPairs, designTokens, orderStatusTones, tokenHex } from "./tokens"

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8")

/** The custom properties declared in `:root`, lower-cased. */
function rootProperties() {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)
  if (!root) throw new Error(":root block not found in globals.css")
  const properties = new Map<string, string>()
  for (const match of root[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) properties.set(match[1], match[2].trim().toLowerCase())
  return properties
}

describe("design tokens", () => {
  const properties = rootProperties()

  it("are all six-digit HEX colours with unique names", () => {
    const names = designTokens.map((candidate) => candidate.name)
    expect(new Set(names).size).toBe(names.length)
    for (const candidate of designTokens) expect(isHex(candidate.hex), candidate.name).toBe(true)
  })

  it("match globals.css exactly, so the showcase, the tests and the app can't drift", () => {
    for (const candidate of designTokens) {
      expect(properties.get(candidate.name), `--${candidate.name}`).toBe(candidate.hex.toLowerCase())
    }
  })

  it("are all registered for Tailwind, so every token has a utility class", () => {
    for (const candidate of designTokens) {
      expect(css, `--color-${candidate.name}`).toContain(`--color-${candidate.name}: var(--${candidate.name});`)
    }
  })

  it("use the approved brand values", () => {
    expect(tokenHex("primary")).toBe("#D63F08")
    expect(tokenHex("brand-orange")).toBe("#F26A1B")
    expect(tokenHex("input")).toBe("#9A8B82")
  })

  it("define no dark theme (out of scope)", () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
  })

  it("set the interface font to Plus Jakarta Sans and keep Geist Mono for code", () => {
    expect(css).toContain("--font-sans: var(--font-jakarta);")
    expect(css).toContain("--font-mono: var(--font-geist-mono);")
  })
})

describe("WCAG 2.2 AA contrast", () => {
  it.each(contrastPairs)("$label ($foreground on $background) needs $minimum:1", ({ foreground, background, minimum }) => {
    const ratio = contrastRatio(tokenHex(foreground), tokenHex(background))
    expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum)
  })

  it("keeps the brand colour out of small text on the page: #D63F08 text there is below 4.5:1, which is why primary-text exists", () => {
    expect(contrastRatio(tokenHex("primary"), tokenHex("background"))).toBeLessThan(4.5)
    expect(contrastRatio(tokenHex("primary-text"), tokenHex("background"))).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps the decorative orange for large shapes and icons only", () => {
    expect(contrastRatio(tokenHex("brand-orange"), tokenHex("card"))).toBeLessThan(4.5)
  })

  it("gives control borders at least 3:1, and decorative borders may be lighter", () => {
    expect(contrastRatio(tokenHex("input"), tokenHex("card"))).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(tokenHex("border"), tokenHex("background"))).toBeLessThan(3)
  })
})

describe("order status tones", () => {
  it("map every Orders status to a defined tone", () => {
    expect(orderStatusTones.map((entry) => entry.status)).toEqual([
      "Scheduled", "Pending", "Accepted", "Ready", "Out for delivery", "Completed", "Rejected", "Cancelled",
    ])
    for (const { tone } of orderStatusTones) {
      expect(designTokens.some((candidate) => candidate.name === `${tone}-soft`), tone).toBe(true)
    }
  })
})
