// @vitest-environment node
import { existsSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { dashboardNavigation, getActiveNavItem } from "./navigation"

const items = dashboardNavigation.flatMap((group) => group.items)
const appDir = join(process.cwd(), "src", "app", "(dashboard)")

describe("dashboard navigation", () => {
  it("only links to pages that exist", () => {
    for (const item of items.filter((candidate) => candidate.href)) {
      expect(existsSync(join(appDir, item.href!, "page.tsx")), item.href!).toBe(true)
    }
  })

  it("leaves Release 2 modules out (POS 10, QR dine-in 11, multi-outlet 21)", () => {
    const modules = new Set(items.map((item) => item.prdModule))
    for (const releaseTwo of [10, 11, 21]) expect(modules.has(releaseTwo)).toBe(false)
  })

  it("has unique titles", () => {
    const titles = items.map((item) => item.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it("selects the most specific item", () => {
    expect(getActiveNavItem("/menu/categories")?.title).toBe("Categories")
    expect(getActiveNavItem("/menu/abc/edit")?.title).toBe("Menu")
    expect(getActiveNavItem("/orders/PRV-1001")?.title).toBe("Orders")
    expect(getActiveNavItem("/menus")).toBeNull()
  })
})
