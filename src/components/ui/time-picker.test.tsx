import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TimePicker } from "./time-picker"

describe("TimePicker", () => {
  it("shows the stored 24-hour value as a 12-hour time", () => {
    render(<TimePicker id="t" value="23:59" />)
    expect(screen.getByRole("textbox")).toHaveValue("11:59 PM")
  })

  it("shows midnight and noon correctly", () => {
    const { rerender } = render(<TimePicker id="t" value="00:00" />)
    expect(screen.getByRole("textbox")).toHaveValue("12:00 AM")
    rerender(<TimePicker id="t" value="12:00" />)
    expect(screen.getByRole("textbox")).toHaveValue("12:00 PM")
  })

  it("reports 24-hour HH:mm when a 12-hour time is typed", () => {
    const onChange = vi.fn()
    render(<TimePicker id="t" value="09:00" onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "6:30 pm" } })
    expect(onChange).toHaveBeenLastCalledWith("18:30")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "12 am" } })
    expect(onChange).toHaveBeenLastCalledWith("00:00")
  })

  it("does not report half-typed or invalid text, and restores the stored value on blur", () => {
    const onChange = vi.fn()
    render(<TimePicker id="t" value="09:00" onChange={onChange} />)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "6:3" } })
    fireEvent.change(input, { target: { value: "25:00" } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(input).toHaveValue("9:00 AM")
  })

  it("picks a preset, an hour and AM/PM as 24-hour values", () => {
    const onChange = vi.fn()
    render(<TimePicker id="t" value="18:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Open time picker" }))
    fireEvent.click(screen.getByRole("button", { name: "10:00 PM" }))
    expect(onChange).toHaveBeenLastCalledWith("22:00")
    fireEvent.click(screen.getByRole("button", { name: "AM" }))
    expect(onChange).toHaveBeenLastCalledWith("06:00")
    fireEvent.click(screen.getByRole("button", { name: "12" }))
    expect(onChange).toHaveBeenLastCalledWith("12:00")
  })
})
