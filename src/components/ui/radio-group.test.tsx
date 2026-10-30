import { useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RadioGroup, RadioGroupItem } from "./radio-group"

function Options({ disabled }: { disabled?: string }) {
  return (
    <>
      {["a", "b", "c"].map((value) => (
        <RadioGroupItem key={value} value={value} aria-label={`Option ${value}`} disabled={value === disabled} />
      ))}
    </>
  )
}

function Controlled({ onValueChange }: { onValueChange?: (value: string) => void }) {
  const [value, setValue] = useState("a")
  return (
    <RadioGroup
      aria-label="Choices"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange?.(next)
      }}
    >
      <Options />
    </RadioGroup>
  )
}

const radio = (name: string) => screen.getByRole("radio", { name })

/** A quick key tap: keyup arrives before Radix's roving focus moves (the case Radix alone misses). */
function tap(element: HTMLElement, key: string, init: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(element, { key, ...init })
  fireEvent.keyUp(element, { key, ...init })
}

describe("RadioGroup keyboard behaviour", () => {
  it("moves focus and selects with arrow keys (uncontrolled)", async () => {
    render(
      <RadioGroup aria-label="Choices" defaultValue="a">
        <Options />
      </RadioGroup>
    )
    act(() => radio("Option a").focus())
    tap(radio("Option a"), "ArrowDown")
    await waitFor(() => expect(radio("Option b")).toBeChecked())
    expect(radio("Option b")).toHaveFocus()
    expect(radio("Option a")).not.toBeChecked()
  })

  it("selects through onValueChange when controlled, and wraps round", async () => {
    const onValueChange = vi.fn()
    render(<Controlled onValueChange={onValueChange} />)
    act(() => radio("Option a").focus())
    tap(radio("Option a"), "ArrowUp")
    await waitFor(() => expect(radio("Option c")).toBeChecked())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("c")
    tap(radio("Option c"), "ArrowRight")
    await waitFor(() => expect(radio("Option a")).toBeChecked())
    expect(onValueChange).toHaveBeenLastCalledWith("a")
  })

  it("skips disabled options", async () => {
    render(
      <RadioGroup aria-label="Choices" defaultValue="a">
        <Options disabled="b" />
      </RadioGroup>
    )
    act(() => radio("Option a").focus())
    tap(radio("Option a"), "ArrowDown")
    await waitFor(() => expect(radio("Option c")).toBeChecked())
    expect(radio("Option b")).not.toBeChecked()
  })

  it("ignores arrows with modifier keys and other keys, and still calls the consumer's onKeyDown", async () => {
    const onKeyDown = vi.fn()
    render(
      <RadioGroup aria-label="Choices" defaultValue="a" onKeyDown={onKeyDown}>
        <Options />
      </RadioGroup>
    )
    act(() => radio("Option a").focus())
    tap(radio("Option a"), "ArrowDown", { ctrlKey: true })
    tap(radio("Option a"), "ArrowDown", { shiftKey: true })
    tap(radio("Option a"), "x")
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(radio("Option a")).toBeChecked()
    expect(radio("Option a")).toHaveFocus()
    expect(onKeyDown).toHaveBeenCalledTimes(3)
  })

  it("entering the group by keyboard lands on the checked option", () => {
    render(<Controlled />)
    act(() => screen.getByRole("radiogroup", { name: "Choices" }).focus())
    expect(radio("Option a")).toHaveFocus()
    expect(radio("Option b")).toHaveAttribute("tabindex", "-1")
  })
})
