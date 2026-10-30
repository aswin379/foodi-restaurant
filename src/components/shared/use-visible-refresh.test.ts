import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { REFRESH_INTERVAL_MS, useVisibleRefresh } from "./use-visible-refresh"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

let visibility: DocumentVisibilityState = "visible"
beforeEach(() => {
  vi.useFakeTimers()
  refresh.mockReset()
  visibility = "visible"
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const setVisibility = (value: DocumentVisibilityState) => {
  visibility = value
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

describe("useVisibleRefresh", () => {
  it("refreshes every 15 seconds while the tab is visible", () => {
    renderHook(() => useVisibleRefresh())
    expect(REFRESH_INTERVAL_MS).toBe(15_000)
    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS - 1))
    expect(refresh).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("doesn't poll while hidden, and refreshes once when the tab is shown again", () => {
    renderHook(() => useVisibleRefresh())
    setVisibility("hidden")
    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 3))
    expect(refresh).not.toHaveBeenCalled()
    setVisibility("visible")
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("stops on unmount, and does nothing when disabled", () => {
    const { unmount } = renderHook(() => useVisibleRefresh())
    unmount()
    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2))
    setVisibility("visible")
    renderHook(() => useVisibleRefresh(false))
    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2))
    expect(refresh).not.toHaveBeenCalled()
  })
})
