// @vitest-environment node
import { existsSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { dashboardNavigation, getActiveChild, getActiveNavItem, getOwnerPageTitle, pathOf } from "./navigation"

const items = dashboardNavigation.flatMap((group) => group.items)
const appDir = join(process.cwd(), "src", "app", "(dashboard)")

describe("dashboard navigation", () => {
  it("only links to pages that exist", () => {
    for (const item of items.filter((candidate) => candidate.href)) {
      expect(existsSync(join(appDir, item.href!, "page.tsx")), item.href!).toBe(true)
    }
    for (const child of items.flatMap((item) => item.children ?? [])) {
      expect(existsSync(join(appDir, pathOf(child.href), "page.tsx")), child.href).toBe(true)
    }
  })

  it("puts Activity, History and Delivery boys under Delivery, with no separate My delivery boys item", () => {
    const delivery = items.find((item) => item.title === "Delivery")
    expect(delivery?.children?.map((child) => [child.title, child.href])).toEqual([
      ["Activity", "/delivery"],
      ["History", "/delivery?view=history"],
      ["Delivery boys", "/delivery-boys"],
    ])
    expect(delivery?.children?.filter((child) => child.requiresOwnDelivery).map((child) => child.title)).toEqual(["Delivery boys"])
    expect(items.some((item) => item.title === "My delivery boys")).toBe(false)
  })

  // POS (10) and Tables (also module 10) are listed because the owner asked for the POS UI ahead of Release 2.
  // They are design-and-preview screens: payment, tables and order entry say they aren't connected.
  it("leaves the other Release 2 modules out (QR dine-in 11, multi-outlet 21)", () => {
    const modules = new Set(items.map((item) => item.prdModule))
    for (const releaseTwo of [11, 21]) expect(modules.has(releaseTwo)).toBe(false)
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

  it("selects Delivery for each of its sub-pages", () => {
    for (const path of ["/delivery", "/delivery-boys", "/delivery-boys/new", "/delivery/anything"]) {
      expect(getActiveNavItem(path)?.title, path).toBe("Delivery")
    }
  })

  it("selects the open sub-link: History only while its query matches, otherwise Activity", () => {
    const delivery = items.find((item) => item.title === "Delivery")!
    const active = (path: string, query = "") => getActiveChild(delivery, path, new URLSearchParams(query))?.title
    expect(active("/delivery")).toBe("Activity")
    expect(active("/delivery", "view=active")).toBe("Activity")
    expect(active("/delivery", "view=history")).toBe("History")
    expect(active("/delivery-boys")).toBe("Delivery boys")
    expect(active("/delivery-boys/new")).toBe("Delivery boys")
    expect(getActiveChild(delivery, "/delivery", null)?.title).toBe("Activity")
    expect(getActiveChild(delivery, "/orders", null)).toBeNull()
  })

  it("titles the owner-level pages", () => {
    expect(getOwnerPageTitle("/restaurants")).toBe("My restaurants")
    expect(getOwnerPageTitle("/restaurants/new")).toBe("Add restaurant")
    expect(getOwnerPageTitle("/restaurants/12")).toBe("Restaurant application")
    expect(getOwnerPageTitle("/orders")).toBeNull()
  })
})
