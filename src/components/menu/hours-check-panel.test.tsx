import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { HoursForCheck } from "@/lib/menu/hours-warnings"
import { itemDraft } from "@/lib/menu/test-drafts"
import type { MenuCategory } from "@/lib/menu/types"

import { HoursCheckPanel } from "./hours-check-panel"

const ALL_ON = { delivery: true, takeaway: true, dine_in: true }
const category: MenuCategory = {
  id: "prv-cat-mains",
  name: "Mains",
  description: null,
  position: 1,
  active: true,
  channels: ALL_ON,
  schedule: { mode: "always" },
  archived: false,
  usedOnOrders: true,
  itemCount: 1,
}
const hours: HoursForCheck = {
  kind: "loaded",
  timeZone: "Asia/Kolkata",
  byOrderType: {
    delivery: [{ days: ["mon"], allDay: false, windows: [{ start: "11:00", end: "22:00" }] }],
    takeaway: [{ days: ["mon"], allDay: false, windows: [{ start: "11:00", end: "22:00" }] }],
    dine_in: [{ days: ["mon"], allDay: false, windows: [{ start: "11:00", end: "22:00" }] }],
  },
}
const lunch = { mode: "meal_periods" as const, periods: [{ periodId: "meal-lunch", channels: ["takeaway" as const] }] }

const panel = (props: Partial<Parameters<typeof HoursCheckPanel>[0]>) =>
  render(
    <HoursCheckPanel
      draft={itemDraft()}
      categories={[category]}
      mealPeriods={[]}
      hours={hours}
      timeZone="Asia/Kolkata"
      {...props}
    />
  )

describe("HoursCheckPanel", () => {
  it("always states its limits and that it's advisory", () => {
    panel({})
    const region = screen.getByRole("region", { name: "Check against restaurant hours" })
    expect(region).toHaveTextContent("Advisory only; it never stops you saving.")
    expect(region).toHaveTextContent("special dates, pauses, sold out, a switched-off category and daylight-saving changes aren't included")
    expect(region).toHaveTextContent("Foodi decides actual availability.")
  })

  it("says it's unable to evaluate, with the reasons, instead of guessing", () => {
    panel({ draft: itemDraft({ schedule: lunch }), mealPeriods: null, hours: { kind: "unavailable", reason: "Restaurant hours aren't connected yet." } })
    expect(screen.getByText("Unable to evaluate schedule")).toBeInTheDocument()
    expect(screen.getByText("Restaurant hours aren't connected yet.")).toBeInTheDocument()
    expect(screen.getByText("Meal periods couldn't be loaded.")).toBeInTheDocument()
    expect(screen.queryByText(/No conflicts/)).not.toBeInTheDocument()
  })

  it("is unable to evaluate when categories couldn't be loaded", () => {
    panel({ categories: null })
    expect(screen.getByText("Unable to evaluate schedule")).toBeInTheDocument()
    expect(screen.getByText("Categories couldn't be loaded.")).toBeInTheDocument()
  })

  it("waits for a category and a valid schedule before checking", () => {
    const { unmount } = panel({ draft: itemDraft({ categoryId: "" }) })
    expect(screen.getByText("Choose a category to check this item against restaurant hours.")).toBeInTheDocument()
    unmount()
    panel({ draft: itemDraft({ schedule: { mode: "meal_periods", periods: [] } }) })
    expect(screen.getByText("Fix the schedule to check it against restaurant hours.")).toBeInTheDocument()
  })

  it("marks the never-orderable warning as the stronger one", () => {
    panel({ categories: [{ ...category, channels: { delivery: false, takeaway: false, dine_in: false } }] })
    expect(screen.getByText(/Strong warning:/)).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Hours warnings" })).toHaveTextContent("This item may never be orderable")
  })
})
