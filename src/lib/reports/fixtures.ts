import type { RangeReport, ReportsData, ReportSlice } from "./index"

// Preview-only sample figures, made up and deterministic. They are not a real restaurant's results.
const hourly = [0, 0, 0, 0, 0, 0, 0, 0, 1200, 3400, 5200, 11800, 21400, 17600, 9800, 6100, 5400, 7800, 15200, 24600, 28900, 19800, 8600, 2100].map(
  (amount, hour): ReportSlice => ({ label: `${String(hour).padStart(2, "0")}:00`, value: amount * 10 })
)
const daily = (days: number): ReportSlice[] =>
  Array.from({ length: days }, (_, index) => {
    const weekend = [5, 6].includes(index % 7)
    return { label: `Day ${index + 1}`, value: ((weekend ? 168000 : 112000) + ((index * 7919) % 31000) * 4) * 10 }
  })

const sum = (slices: ReportSlice[]) => slices.reduce((total, slice) => total + slice.value, 0)

function range(trend: ReportSlice[], unit: "hour" | "day", orders: number): RangeReport {
  const sales = sum(trend)
  const share = (parts: [string, number][]): ReportSlice[] => parts.map(([label, fraction]) => ({ label, value: Math.round(sales * fraction) }))
  return {
    salesMinor: sales,
    orders,
    trend,
    trendUnit: unit,
    bestSellers: [
      { name: "Paneer butter masala", quantity: Math.round(orders * 0.18), salesMinor: Math.round(sales * 0.16) },
      { name: "Chicken biryani", quantity: Math.round(orders * 0.15), salesMinor: Math.round(sales * 0.17) },
      { name: "Masala dosa", quantity: Math.round(orders * 0.13), salesMinor: Math.round(sales * 0.09) },
      { name: "Butter naan", quantity: Math.round(orders * 0.12), salesMinor: Math.round(sales * 0.05) },
      { name: "Filter coffee", quantity: Math.round(orders * 0.1), salesMinor: Math.round(sales * 0.04) },
    ],
    categories: share([["Mains", 0.38], ["Rice and biryani", 0.24], ["Breads", 0.12], ["Starters", 0.14], ["Drinks", 0.12]]),
    orderTypes: share([["Delivery", 0.46], ["Dine-in", 0.34], ["Takeaway", 0.2]]),
    payments: share([["Online", 0.64], ["Cash", 0.36]]),
    cancelledOrders: Math.max(1, Math.round(orders * 0.04)),
    refundedMinor: Math.round(sales * 0.012),
    settlement: { pendingMinor: Math.round(sales * 0.42), paidOutMinor: Math.round(sales * 3.1) },
  }
}

export const PREVIEW_REPORTS: ReportsData = {
  today: range(hourly, "hour", 64),
  "7d": range(daily(7), "day", 412),
  "30d": range(daily(30), "day", 1760),
}
